"""
OptiCloud — Extended API Endpoints
Adds: /api/anomalies, /api/cost-overview, /api/report, /api/logout
Zero modification to existing /api/upload, /api/process, /api/resources,
/api/recommendations, /api/dashboard, /api/schema-info endpoints.
"""

from collections import defaultdict
from typing import List, Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Resource

router = APIRouter(prefix="/api")


# ═══════════════════════════════════════════════════════════════════════════════
# Pydantic response models (new — do not touch schemas.py)
# ═══════════════════════════════════════════════════════════════════════════════

class AnomalyRecord(BaseModel):
    resource_id:    str
    service:        str
    region:         str
    cost:           float
    expected_cost:  float
    anomaly_score:  float
    reason:         str


class RegionEfficiency(BaseModel):
    region:           str
    total_cost:       float
    avg_cpu:          float
    avg_memory:       float
    cost_per_usage:   float
    efficiency_flag:  str          # "efficient" | "inefficient" | "average"


class UnderutilizedResource(BaseModel):
    resource_id:    str
    service:        str
    region:         str
    cost:           float
    cpu:            float
    memory:         float
    reason:         str


class CostOverviewResponse(BaseModel):
    top_3_services_by_cost:         list
    cost_by_region_with_efficiency: List[RegionEfficiency]
    underutilized_resources:        List[UnderutilizedResource]


class ReportResponse(BaseModel):
    generated_at:    str
    dashboard:       dict
    top_anomalies:   List[AnomalyRecord]
    cost_insights:   dict
    recommendations: list


# ═══════════════════════════════════════════════════════════════════════════════
# Shared helper — build DataFrame from DB rows
# ═══════════════════════════════════════════════════════════════════════════════

def _load_df(db: Session) -> pd.DataFrame:
    rows = db.query(Resource).all()
    if not rows:
        raise HTTPException(
            status_code=404,
            detail="No data found. Upload and process a CSV first."
        )
    return pd.DataFrame([{
        "resource_id":       r.resource_id,
        "resource_type":     r.resource_type,
        "region":            r.region,
        "cost":              r.cost,
        "runtime_hours":     r.runtime_hours,
        "cpu_utilization":   r.cpu_utilization,
        "memory_utilization":r.memory_utilization,
        "cluster":           r.cluster,
        "anomaly":           r.anomaly,
    } for r in rows])


# ═══════════════════════════════════════════════════════════════════════════════
# Anomaly scoring helper
# ═══════════════════════════════════════════════════════════════════════════════

def _compute_anomaly_score(cost: float, expected: float, cpu: float, mem: float) -> float:
    """
    Score ∈ [0, 1].
    Weighted combination of:
      - cost deviation from expected   (60%)
      - low utilisation relative to cost (40%)
    """
    cost_dev = abs(cost - expected) / (expected + 1e-9)
    util_avg = (cpu + mem) / 2.0          # already 0-1 normalised
    low_util_penalty = max(0.0, 1.0 - util_avg)
    raw = 0.60 * min(cost_dev, 2.0) / 2.0 + 0.40 * low_util_penalty
    return round(float(np.clip(raw, 0.0, 1.0)), 4)


def _anomaly_reason(cost: float, expected: float, cpu: float, mem: float) -> str:
    """
    Return a specific, data-driven reason string — never generic text.
    """
    cost_pct = (cost - expected) / (expected + 1e-9) * 100
    util_avg = (cpu + mem) / 2.0 * 100     # convert to percentage

    if cost_pct > 30 and util_avg < 30:
        return (f"Cost is {cost_pct:.0f}% above cluster average "
                f"while utilisation is only {util_avg:.0f}% — "
                f"cost significantly higher than expected for this workload pattern.")
    if cost_pct > 30:
        return (f"Cost is {cost_pct:.0f}% above the cluster baseline "
                f"({expected:.4f} expected vs {cost:.4f} actual) — "
                f"cost significantly higher than expected.")
    if util_avg < 20 and cost > expected * 0.8:
        return (f"Unusual usage pattern: utilisation is {util_avg:.0f}% "
                f"but cost ({cost:.4f}) is within {abs(cost_pct):.0f}% of cluster average, "
                f"suggesting resource is idling at near-full cost.")
    if abs(cost_pct) < 15 and util_avg < 15:
        return (f"Unusual usage pattern: extremely low utilisation ({util_avg:.0f}%) "
                f"with cost close to cluster average — resource appears consistently idle.")
    return (f"Unusual usage pattern: cost deviation {cost_pct:+.0f}% from cluster mean "
            f"with {util_avg:.0f}% average utilisation.")


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/anomalies
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/anomalies", response_model=List[AnomalyRecord],
            summary="Detailed anomaly records with expected cost and dynamic reason")
def get_anomalies(db: Session = Depends(get_db)):
    df = _load_df(db)

    anomalies = df[df["anomaly"] == True].copy()
    if anomalies.empty:
        return []

    # Compute expected cost: cluster mean if cluster labels exist, else dataset mean
    if df["cluster"].notna().any():
        cluster_mean = df.groupby("cluster")["cost"].mean().to_dict()
        anomalies["expected_cost"] = anomalies["cluster"].map(cluster_mean).fillna(df["cost"].mean())
    else:
        dataset_mean = df["cost"].mean()
        anomalies["expected_cost"] = dataset_mean

    records = []
    for _, row in anomalies.iterrows():
        exp   = float(row["expected_cost"])
        cost  = float(row["cost"])
        cpu   = float(row["cpu_utilization"])
        mem   = float(row["memory_utilization"])
        score = _compute_anomaly_score(cost, exp, cpu, mem)
        reason = _anomaly_reason(cost, exp, cpu, mem)

        records.append(AnomalyRecord(
            resource_id   = row["resource_id"],
            service       = row["resource_type"],
            region        = row["region"],
            cost          = round(cost, 6),
            expected_cost = round(exp, 6),
            anomaly_score = score,
            reason        = reason,
        ))

    # Sort by anomaly_score descending
    records.sort(key=lambda r: r.anomaly_score, reverse=True)
    return records


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/cost-overview
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/cost-overview", response_model=CostOverviewResponse,
            summary="Top services by cost, region efficiency, underutilised resources")
def get_cost_overview(db: Session = Depends(get_db)):
    df = _load_df(db)

    # ── Top 3 services by cost ────────────────────────────────────────────────
    svc_cost = (
        df.groupby("resource_type")["cost"]
        .sum()
        .sort_values(ascending=False)
        .head(3)
    )
    top_3 = [
        {"service": svc, "total_cost": round(float(cost), 6),
         "resource_count": int((df["resource_type"] == svc).sum())}
        for svc, cost in svc_cost.items()
    ]

    # ── Cost by region with efficiency ───────────────────────────────────────
    # cost_per_usage = cost / (avg_cpu + avg_memory + ε)  — higher = less efficient
    region_stats = df.groupby("region").agg(
        total_cost   = ("cost",               "sum"),
        avg_cpu      = ("cpu_utilization",    "mean"),
        avg_memory   = ("memory_utilization", "mean"),
    ).reset_index()

    region_stats["usage_proxy"]    = (region_stats["avg_cpu"] + region_stats["avg_memory"]) / 2 + 1e-9
    region_stats["cost_per_usage"] = region_stats["total_cost"] / region_stats["usage_proxy"]

    dataset_avg_cpu = float(df["cost_per_usage"].mean()) if "cost_per_usage" in df else \
                      float(region_stats["cost_per_usage"].mean())

    eff_mean  = float(region_stats["cost_per_usage"].mean())
    eff_std   = float(region_stats["cost_per_usage"].std()) + 1e-9

    def eff_flag(cpu_val: float) -> str:
        z = (cpu_val - eff_mean) / eff_std
        if z > 0.75:  return "inefficient"
        if z < -0.75: return "efficient"
        return "average"

    region_efficiency = [
        RegionEfficiency(
            region          = row["region"],
            total_cost      = round(float(row["total_cost"]), 6),
            avg_cpu         = round(float(row["avg_cpu"]) * 100, 2),
            avg_memory      = round(float(row["avg_memory"]) * 100, 2),
            cost_per_usage  = round(float(row["cost_per_usage"]), 6),
            efficiency_flag = eff_flag(float(row["cost_per_usage"])),
        )
        for _, row in region_stats.iterrows()
    ]
    region_efficiency.sort(key=lambda r: r.cost_per_usage, reverse=True)

    # ── Underutilised resources: low usage AND cost > dataset median ──────────
    cost_median = float(df["cost"].median())
    util_avg    = (df["cpu_utilization"] + df["memory_utilization"]) / 2

    # Low utilisation threshold: bottom 25th percentile of utilisation
    util_low_thresh = float(util_avg.quantile(0.25))
    cost_high_thresh = cost_median

    mask_under = (util_avg <= util_low_thresh) & (df["cost"] >= cost_high_thresh)
    under_df   = df[mask_under].copy()
    under_df["util_avg"] = (under_df["cpu_utilization"] + under_df["memory_utilization"]) / 2

    def _under_reason(cpu: float, mem: float, cost: float) -> str:
        util = (cpu + mem) / 2 * 100
        if cpu * 100 < 10:
            return (f"CPU utilisation is {cpu*100:.1f}% — critically idle "
                    f"while cost ({cost:.4f}) exceeds dataset median. "
                    f"Resource is paying full price for near-zero work.")
        if mem * 100 < 20:
            return (f"Memory utilisation is {mem*100:.1f}% with CPU at {cpu*100:.1f}%. "
                    f"Cost ({cost:.4f}) above median — instance is oversized for actual load.")
        return (f"Average utilisation {util:.1f}% is below the 25th-percentile threshold "
                f"but cost ({cost:.4f}) exceeds the dataset median — "
                f"resource is underperforming relative to spend.")

    underutilized = [
        UnderutilizedResource(
            resource_id = row["resource_id"],
            service     = row["resource_type"],
            region      = row["region"],
            cost        = round(float(row["cost"]), 6),
            cpu         = round(float(row["cpu_utilization"]) * 100, 2),
            memory      = round(float(row["memory_utilization"]) * 100, 2),
            reason      = _under_reason(row["cpu_utilization"], row["memory_utilization"], row["cost"]),
        )
        for _, row in under_df.sort_values("cost", ascending=False).head(20).iterrows()
    ]

    return CostOverviewResponse(
        top_3_services_by_cost         = top_3,
        cost_by_region_with_efficiency = region_efficiency,
        underutilized_resources        = underutilized,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/report
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/report", response_model=ReportResponse,
            summary="Combined report: dashboard + anomalies + cost insights + recommendations")
def get_report(db: Session = Depends(get_db)):
    from datetime import datetime, timezone

    df = _load_df(db)
    rows = db.query(Resource).all()

    # ── Dashboard summary (mirrors /api/dashboard logic exactly) ─────────────
    total_cost      = round(float(df["cost"].sum()), 6)
    total_resources = len(df)
    anomaly_count   = int(df["anomaly"].sum())

    cost_by_type   = df.groupby("resource_type")["cost"].sum().round(6).sort_values(ascending=False).to_dict()
    cost_by_region = df.groupby("region")["cost"].sum().round(6).sort_values(ascending=False).to_dict()

    dashboard_summary = {
        "total_cost":       total_cost,
        "total_resources":  total_resources,
        "anomaly_count":    anomaly_count,
        "anomaly_rate_pct": round(anomaly_count / total_resources * 100, 2) if total_resources else 0,
        "cost_by_type":     cost_by_type,
        "cost_by_region":   cost_by_region,
    }

    # ── Top 5 anomalies ───────────────────────────────────────────────────────
    anomalies_df = df[df["anomaly"] == True].copy()
    top_anomalies = []
    if not anomalies_df.empty:
        if df["cluster"].notna().any():
            cluster_mean = df.groupby("cluster")["cost"].mean().to_dict()
            anomalies_df["expected_cost"] = anomalies_df["cluster"].map(cluster_mean).fillna(df["cost"].mean())
        else:
            anomalies_df["expected_cost"] = df["cost"].mean()

        for _, row in anomalies_df.iterrows():
            exp    = float(row["expected_cost"])
            cost   = float(row["cost"])
            cpu    = float(row["cpu_utilization"])
            mem    = float(row["memory_utilization"])
            score  = _compute_anomaly_score(cost, exp, cpu, mem)
            reason = _anomaly_reason(cost, exp, cpu, mem)
            top_anomalies.append(AnomalyRecord(
                resource_id   = row["resource_id"],
                service       = row["resource_type"],
                region        = row["region"],
                cost          = round(cost, 6),
                expected_cost = round(exp, 6),
                anomaly_score = score,
                reason        = reason,
            ))
        top_anomalies.sort(key=lambda r: r.anomaly_score, reverse=True)
        top_anomalies = top_anomalies[:5]

    # ── Cost insights ─────────────────────────────────────────────────────────
    region_stats = df.groupby("region").agg(
        total_cost = ("cost", "sum"),
        avg_cpu    = ("cpu_utilization", "mean"),
        avg_memory = ("memory_utilization", "mean"),
    ).reset_index()
    region_stats["usage_proxy"]    = (region_stats["avg_cpu"] + region_stats["avg_memory"]) / 2 + 1e-9
    region_stats["cost_per_usage"] = region_stats["total_cost"] / region_stats["usage_proxy"]

    eff_mean = float(region_stats["cost_per_usage"].mean())
    eff_std  = float(region_stats["cost_per_usage"].std()) + 1e-9
    inefficient_regions = region_stats[
        (region_stats["cost_per_usage"] - eff_mean) / eff_std > 0.75
    ]["region"].tolist()

    cost_insights = {
        "avg_cost_per_resource":    round(total_cost / total_resources, 6) if total_resources else 0,
        "cost_std_dev":             round(float(df["cost"].std()), 6),
        "top_cost_driver":          next(iter(cost_by_type), "N/A"),
        "costliest_region":         next(iter(cost_by_region), "N/A"),
        "inefficient_regions":      inefficient_regions,
        "underutilized_count":      int(
            ((df["cpu_utilization"] + df["memory_utilization"]) / 2
             <= ((df["cpu_utilization"] + df["memory_utilization"]) / 2).quantile(0.25)
            ).sum()
        ),
    }

    # ── Dynamic recommendations (based on anomalies + inefficiencies) ─────────
    recommendations = []

    # From anomalies
    for rec in top_anomalies[:3]:
        cost_pct = (rec.cost - rec.expected_cost) / (rec.expected_cost + 1e-9) * 100
        recommendations.append({
            "resource_id": rec.resource_id,
            "service":     rec.service,
            "region":      rec.region,
            "type":        "anomaly",
            "priority":    "high" if rec.anomaly_score > 0.65 else "medium",
            "action":      (
                f"Investigate cost spike on {rec.service} in {rec.region}. "
                f"Cost is {cost_pct:+.0f}% relative to cluster average. "
                f"{rec.reason}"
            ),
            "estimated_impact": round(rec.cost - rec.expected_cost, 6),
        })

    # From inefficient regions
    for region in inefficient_regions[:2]:
        region_row = region_stats[region_stats["region"] == region].iloc[0]
        recommendations.append({
            "resource_id": "region-level",
            "service":     "multiple",
            "region":      region,
            "type":        "efficiency",
            "priority":    "medium",
            "action":      (
                f"Region '{region}' has cost-per-usage ratio of "
                f"{region_row['cost_per_usage']:.4f} vs dataset average {eff_mean:.4f}. "
                f"Avg CPU: {region_row['avg_cpu']*100:.1f}%, "
                f"Avg Memory: {region_row['avg_memory']*100:.1f}%. "
                f"Consider migrating low-utilisation workloads to a more cost-efficient region."
            ),
            "estimated_impact": round(
                float(region_row["total_cost"]) * 0.20, 6   # 20% projected saving
            ),
        })

    return ReportResponse(
        generated_at    = datetime.now(timezone.utc).isoformat(),
        dashboard       = dashboard_summary,
        top_anomalies   = top_anomalies,
        cost_insights   = cost_insights,
        recommendations = recommendations,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/logout
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/logout", summary="Clear session (stateless — returns success)")
def logout():
    return {"status": "success", "message": "Logged out successfully."}