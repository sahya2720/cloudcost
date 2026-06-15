import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

# ── Column alias map: accept both naming conventions ──────────────────────────
# Key   = canonical internal name (used throughout the pipeline)
# Value = list of accepted CSV column names (first match wins)
COLUMN_ALIASES = {
    "resource_id":        ["resource_id",        "instance_id"],
    "resource_type":      ["resource_type",       "service_type"],
    "region":             ["region"],
    "cost":               ["cost"],
    "runtime_hours":      ["runtime_hours"],
    "cpu_utilization":    ["cpu_utilization"],
    "memory_utilization": ["memory_utilization"],
}

# Columns that MUST be present (under any accepted alias)
REQUIRED_COLUMNS = list(COLUMN_ALIASES.keys())


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Rename CSV columns to canonical internal names.
    Raises ValueError listing every canonical column that has no match.
    """
    rename_map = {}
    missing = []

    for canonical, aliases in COLUMN_ALIASES.items():
        if canonical in df.columns:
            continue                          # already correct name
        matched = next((a for a in aliases if a in df.columns), None)
        if matched:
            rename_map[matched] = canonical
        else:
            missing.append(f"{canonical} (tried: {aliases})")

    if missing:
        raise ValueError(
            f"Missing required columns: {missing}. "
            f"Found in CSV: {list(df.columns)}"
        )

    return df.rename(columns=rename_map)


def run_ml_pipeline(df: pd.DataFrame) -> pd.DataFrame:
    """
    Accepts a DataFrame whose columns have already been normalised
    (or will be normalised here).
    Returns the same DataFrame augmented with 'cluster' and 'anomaly'.
    """
    df = df.copy()

    # Normalise column names in case the caller skipped it
    df = normalize_columns(df)

    # ── 1. Type coercion ──────────────────────────────────────────────────────
    for col in ["cost", "runtime_hours", "cpu_utilization", "memory_utilization"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # ── 2. Fill missing values ────────────────────────────────────────────────
    numeric_cols = ["cost", "runtime_hours", "cpu_utilization", "memory_utilization"]
    df[numeric_cols] = df[numeric_cols].fillna(df[numeric_cols].median())

    for col in ["resource_id", "resource_type", "region"]:
        df[col] = df[col].fillna("unknown")

    # ── 3. Feature Engineering ────────────────────────────────────────────────
    df["cost_per_hour"] = np.where(
        df["runtime_hours"] > 0,
        df["cost"] / df["runtime_hours"],
        0.0,
    )
    df["efficiency"] = np.where(
        df["cost"] > 0,
        df["cpu_utilization"] / df["cost"],
        0.0,
    )

    # ── 4. Feature matrix ─────────────────────────────────────────────────────
    feature_cols = [
        "cost", "runtime_hours",
        "cpu_utilization", "memory_utilization",
        "cost_per_hour", "efficiency",
    ]
    X = df[feature_cols].values

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # ── 5. KMeans clustering ──────────────────────────────────────────────────
    n_clusters = min(4, len(df))
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    df["cluster"] = kmeans.fit_predict(X_scaled).astype(int)

    # ── 6. Isolation Forest anomaly detection ─────────────────────────────────
    iso = IsolationForest(contamination=0.1, n_estimators=200, random_state=42)
    preds = iso.fit_predict(X_scaled)   # -1 = anomaly, 1 = normal
    df["anomaly"] = (preds == -1)

    return df