import io
from typing import List

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.ml import normalize_columns, run_ml_pipeline, COLUMN_ALIASES
from backend.models import Resource
from backend.schemas import RecommendationResponse, ResourceResponse

router = APIRouter(prefix="/api")


# ── POST /api/upload ──────────────────────────────────────────────────────────
@router.post("/upload", summary="Upload CSV — accepts both instance_id/service_type and resource_id/resource_type column names")
async def upload(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    raw = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}")

    # Normalise column names (handles instance_id→resource_id, service_type→resource_type, etc.)
    try:
        df = normalize_columns(df)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Clear previous data and insert fresh rows
    db.query(Resource).delete()
    db.commit()

    records = []
    for _, row in df.iterrows():
        records.append(
            Resource(
                resource_id        = str(row["resource_id"]),
                resource_type      = str(row["resource_type"]),
                region             = str(row["region"]),
                cost               = float(row["cost"]),
                runtime_hours      = float(row["runtime_hours"]),
                cpu_utilization    = float(row["cpu_utilization"]),
                memory_utilization = float(row["memory_utilization"]),
            )
        )

    db.bulk_save_objects(records)
    db.commit()

    return {
        "status":        "uploaded",
        "rows_inserted": len(records),
        "filename":      file.filename,
        "columns_found": list(df.columns),
    }


# ── POST /api/process ─────────────────────────────────────────────────────────
@router.post("/process", summary="Run ML pipeline and write cluster/anomaly back to DB")
def process(db: Session = Depends(get_db)):
    rows = db.query(Resource).all()
    if not rows:
        raise HTTPException(status_code=400, detail="No data in DB. POST /api/upload first.")

    df = pd.DataFrame(
        [
            {
                "db_id":             r.id,
                "resource_id":       r.resource_id,
                "resource_type":     r.resource_type,
                "region":            r.region,
                "cost":              r.cost,
                "runtime_hours":     r.runtime_hours,
                "cpu_utilization":   r.cpu_utilization,
                "memory_utilization":r.memory_utilization,
            }
            for r in rows
        ]
    )

    processed = run_ml_pipeline(df)

    id_to_row = {r.id: r for r in rows}
    for _, prow in processed.iterrows():
        resource = id_to_row[int(prow["db_id"])]
        resource.cluster = int(prow["cluster"])
        resource.anomaly = bool(prow["anomaly"])

    db.commit()

    anomaly_count = int(processed["anomaly"].sum())
    return {
        "status":        "processed",
        "rows":          len(processed),
        "anomaly_count": anomaly_count,
        "clusters":      int(processed["cluster"].nunique()),
    }


# ── GET /api/resources ────────────────────────────────────────────────────────
@router.get("/resources", response_model=List[ResourceResponse],
            summary="Return all resources with ML results")
def get_resources(db: Session = Depends(get_db)):
    rows = db.query(Resource).all()
    if not rows:
        raise HTTPException(status_code=404, detail="No resources found. Upload and process first.")
    return rows


# ── GET /api/recommendations ──────────────────────────────────────────────────
@router.get("/recommendations", response_model=List[RecommendationResponse],
            summary="Return data-driven recommendations")
def get_recommendations(db: Session = Depends(get_db)):
    rows = db.query(Resource).all()
    if not rows:
        raise HTTPException(status_code=404, detail="No data found. Upload and process first.")

    df = pd.DataFrame(
        [
            {
                "resource_id":       r.resource_id,
                "resource_type":     r.resource_type,
                "region":            r.region,
                "cost":              r.cost,
                "runtime_hours":     r.runtime_hours,
                "cpu_utilization":   r.cpu_utilization,
                "memory_utilization":r.memory_utilization,
                "anomaly":           r.anomaly,
                "cluster":           r.cluster,
            }
            for r in rows
        ]
    )

    recs = []
    cost_90th = df["cost"].quantile(0.90)

    for _, row in df.iterrows():
        cpu  = row["cpu_utilization"]
        mem  = row["memory_utilization"]
        cost = row["cost"]
        rt   = row["runtime_hours"]

        # Rule 1 – Idle instance
        if cpu < 0.10 and rt > 0.80:           # normalised thresholds (0-1 scale)
            recs.append(RecommendationResponse(
                resource_id   = row["resource_id"],
                resource_type = row["resource_type"],
                region        = row["region"],
                issue         = (f"Idle instance: CPU utilisation at {cpu*100:.1f}% "
                                 f"over {rt:.2f} normalised runtime units."),
                suggestion    = ("Shut down or suspend this instance. "
                                 "Consider on-demand or spot provisioning."),
                cost          = round(cost, 4),
                cluster       = int(row["cluster"]) if row["cluster"] is not None else None,
                anomaly       = bool(row["anomaly"]),
                cpu_utilization    = round(cpu, 4),
                memory_utilization = round(mem, 4),
                runtime_hours      = round(rt, 4),
            ))

        # Rule 2 – Over-provisioned
        elif cpu < 0.30 and mem < 0.40:
            recs.append(RecommendationResponse(
                resource_id   = row["resource_id"],
                resource_type = row["resource_type"],
                region        = row["region"],
                issue         = (f"Over-provisioned: CPU {cpu*100:.1f}%, "
                                 f"Memory {mem*100:.1f}% of allocated capacity."),
                suggestion    = ("Downsize to a smaller instance SKU. "
                                 "Review workload patterns over a 7-day window before resizing."),
                cost          = round(cost, 4),
                cluster       = int(row["cluster"]) if row["cluster"] is not None else None,
                anomaly       = bool(row["anomaly"]),
                cpu_utilization    = round(cpu, 4),
                memory_utilization = round(mem, 4),
                runtime_hours      = round(rt, 4),
            ))

        # Rule 3 – High cost (top 10%)
        elif cost >= cost_90th:
            recs.append(RecommendationResponse(
                resource_id   = row["resource_id"],
                resource_type = row["resource_type"],
                region        = row["region"],
                issue         = (f"High-cost resource: normalised cost {cost:.4f} "
                                 f"exceeds the 90th-percentile threshold ({cost_90th:.4f})."),
                suggestion    = ("Review reserved-instance commitments. "
                                 "Set billing alerts and audit data-transfer charges."),
                cost          = round(cost, 4),
                cluster       = int(row["cluster"]) if row["cluster"] is not None else None,
                anomaly       = bool(row["anomaly"]),
                cpu_utilization    = round(cpu, 4),
                memory_utilization = round(mem, 4),
                runtime_hours      = round(rt, 4),
            ))

    recs.sort(key=lambda r: r.cost, reverse=True)
    return recs


# ── GET /api/dashboard ────────────────────────────────────────────────────────
@router.get("/dashboard", summary="Return aggregate KPI metrics")
def get_dashboard(db: Session = Depends(get_db)):
    rows = db.query(Resource).all()
    if not rows:
        raise HTTPException(status_code=404, detail="No data found. Upload and process first.")

    total_cost      = round(sum(r.cost for r in rows), 6)
    total_resources = len(rows)
    anomaly_count   = sum(1 for r in rows if r.anomaly is True)

    # Cost by service type for pie chart
    from collections import defaultdict
    cost_by_type = defaultdict(float)
    cost_by_region = defaultdict(float)
    for r in rows:
        cost_by_type[r.resource_type]  += r.cost
        cost_by_region[r.region]       += r.cost

    return {
        "total_cost":       total_cost,
        "total_resources":  total_resources,
        "anomaly_count":    anomaly_count,
        "cost_by_type":     {k: round(v, 6) for k, v in sorted(cost_by_type.items(),   key=lambda x: -x[1])},
        "cost_by_region":   {k: round(v, 6) for k, v in sorted(cost_by_region.items(), key=lambda x: -x[1])},
    }


# ── GET /api/schema-info ──────────────────────────────────────────────────────
@router.get("/schema-info", summary="Return accepted column name aliases")
def schema_info():
    """Tells the frontend exactly which column names are accepted."""
    return {
        "accepted_aliases": COLUMN_ALIASES,
        "note": "Your CSV may use either name in each alias list.",
    }