"""Precompute the dashboard analytics payload.

The operator dashboard (Phase 5) and the API's ``/analytics/*`` endpoints (Phase 4) do
not run pandas at request time - they read one JSON file produced here by
``scripts/build_analytics.py``. Each function below builds one section; ``build_analytics``
assembles them.

Every number is a plain ``float`` / ``int`` rounded for display, so the result is
directly ``json.dumps``-able. Aggregations use pandas' default "skip NaN" behaviour, so
the 66 missing energy / rate / distance readings are simply excluded from their means.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from evcharging.config import ANALYTICS_JSON

DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _f(x, ndigits: int = 2) -> float | None:
    """Round to a JSON-friendly float, mapping NaN/None to ``None``."""
    if x is None or (isinstance(x, float) and np.isnan(x)) or pd.isna(x):
        return None
    return round(float(x), ndigits)


_INT_COLUMNS = {"sessions", "n_stations", "n_sessions", "hour", "weekday", "cluster"}


def _records(frame: pd.DataFrame) -> list[dict]:
    """DataFrame -> list of row dicts: counts stay ``int``, everything else a rounded float."""
    out = []
    for rec in frame.reset_index().to_dict("records"):
        row = {}
        for k, v in rec.items():
            if isinstance(v, (int, float, np.number)):
                row[k] = int(v) if k in _INT_COLUMNS and pd.notna(v) else _f(v)
            else:
                row[k] = v
        out.append(row)
    return out


def overview(df: pd.DataFrame) -> dict:
    """Headline KPIs for the dashboard's top row."""
    energy = df["energy_kwh"]
    flagged = df["flag_any"] if "flag_any" in df.columns else pd.Series(False, index=df.index)

    by_charger = df["charger_type"].value_counts()
    by_location_energy = df.groupby("location")["energy_kwh"].sum()
    by_hour_energy = df.groupby("hour")["energy_kwh"].mean()

    return {
        "n_sessions": int(len(df)),
        "date_start": df["start_time"].min().date().isoformat(),
        "date_end": df["start_time"].max().date().isoformat(),
        "n_stations": int(df["station_id"].nunique()),
        "n_locations": int(df["location"].nunique()),
        "n_vehicle_models": int(df["vehicle_model"].nunique()),
        "total_energy_kwh": _f(energy.sum()),
        "mean_energy_kwh": _f(energy.mean()),
        "median_energy_kwh": _f(energy.median()),
        "mean_duration_hours": _f(df["duration_hours"].mean()),
        "total_cost_usd": _f(df["cost_usd"].sum()),
        "mean_cost_usd": _f(df["cost_usd"].mean()),
        "mean_charging_rate_kw": _f(df["charging_rate_kw"].mean()),
        "mean_soc_increase_pct": _f(df["soc_delta_pct"].mean()),
        "peak_hour": int(by_hour_energy.idxmax()),
        "most_used_charger_type": str(by_charger.idxmax()),
        "highest_demand_location": str(by_location_energy.idxmax()),
        "data_quality": {
            "n_sessions_flagged": int(flagged.sum()),
            "pct_sessions_flagged": _f(flagged.mean() * 100, 1),
        },
    }


def patterns(df: pd.DataFrame) -> dict:
    """Time-of-day, weekday, charger-type and vehicle-model breakdowns."""
    by_hour = df.groupby("hour").agg(
        sessions=("user_id", "size"),
        mean_energy_kwh=("energy_kwh", "mean"),
        total_energy_kwh=("energy_kwh", "sum"),
    )

    by_weekday = df.groupby("day_name").agg(
        sessions=("user_id", "size"),
        mean_energy_kwh=("energy_kwh", "mean"),
        mean_cost_usd=("cost_usd", "mean"),
    ).reindex(DAY_ORDER)
    by_weekday.index.name = "day_name"

    by_charger = df.groupby("charger_type").agg(
        sessions=("user_id", "size"),
        mean_energy_kwh=("energy_kwh", "mean"),
        mean_duration_hours=("duration_hours", "mean"),
        mean_cost_usd=("cost_usd", "mean"),
        mean_charging_rate_kw=("charging_rate_kw", "mean"),
    )

    by_vehicle = df.groupby("vehicle_model").agg(
        sessions=("user_id", "size"),
        mean_energy_kwh=("energy_kwh", "mean"),
        mean_battery_capacity_kwh=("battery_capacity_kwh", "mean"),
        mean_distance_km=("distance_km", "mean"),
    )

    weekend = df.groupby("is_weekend").agg(
        sessions=("user_id", "size"),
        mean_energy_kwh=("energy_kwh", "mean"),
        mean_duration_hours=("duration_hours", "mean"),
        mean_cost_usd=("cost_usd", "mean"),
    )
    weekend_map = {0: "weekday", 1: "weekend"}

    return {
        "by_hour": _records(by_hour),
        "by_weekday": _records(by_weekday),
        "by_charger_type": _records(by_charger),
        "by_vehicle_model": _records(by_vehicle),
        "weekend_vs_weekday": {
            weekend_map[k]: {kk: _f(vv) for kk, vv in row.items()}
            for k, row in weekend.to_dict("index").items()
        },
    }


def locations(df: pd.DataFrame) -> list[dict]:
    """Per-city summary, sorted by total energy."""
    summary = df.groupby("location").agg(
        sessions=("user_id", "size"),
        n_stations=("station_id", "nunique"),
        total_energy_kwh=("energy_kwh", "sum"),
        mean_energy_kwh=("energy_kwh", "mean"),
        mean_duration_hours=("duration_hours", "mean"),
        mean_cost_usd=("cost_usd", "mean"),
    ).sort_values("total_energy_kwh", ascending=False)
    return _records(summary)


def segments(df: pd.DataFrame, segmenter_bundle: dict | None) -> list[dict]:
    """Cluster profiles from the fitted segmenter, or ``[]`` if none is supplied."""
    if segmenter_bundle is None:
        return []
    from evcharging.models.segmentation import CLUSTER_FEATURES, cluster_profile, prepare_matrix

    labels = segmenter_bundle["pipeline"].predict(prepare_matrix(df))
    profile = cluster_profile(df, labels)

    rows = []
    for cluster, row in profile.iterrows():
        entry = {
            "cluster": int(cluster),
            "archetype": segmenter_bundle["archetypes"].get(int(cluster)),
            "n_sessions": int(row["n_sessions"]),
        }
        entry.update({feat: _f(row[feat]) for feat in CLUSTER_FEATURES})
        rows.append(entry)
    return rows


def anomalies(df: pd.DataFrame, scores: np.ndarray | None) -> dict:
    """Risk buckets and a few worst-offender examples from the anomaly scores."""
    if scores is None:
        return {}
    s = pd.Series(np.asarray(scores), index=df.index)
    high = s >= 0.60
    medium = (s >= 0.40) & ~high

    worst = (
        df.assign(anomaly_score=s.round(3))
        .sort_values("anomaly_score", ascending=False)
        .head(5)[["station_id", "location", "vehicle_model", "energy_kwh",
                  "battery_capacity_kwh", "soc_delta_pct", "anomaly_score"]]
    )
    return {
        "n_high_risk": int(high.sum()),
        "n_medium_risk": int(medium.sum()),
        "n_normal": int((~high & ~medium).sum()),
        "score_bins": {"high": ">= 0.60", "medium": "0.40 - 0.60", "normal": "< 0.40"},
        "worst_sessions": _records(worst.reset_index(drop=True)),
    }


def build_analytics(
    df: pd.DataFrame,
    segmenter_bundle: dict | None = None,
    anomaly_scores: np.ndarray | None = None,
) -> dict:
    """Assemble the full dashboard payload.

    Args:
        df: The processed sessions frame (with engineered features and validation flags).
        segmenter_bundle: Loaded ``session_segmenter.joblib`` for the ``segments`` section.
        anomaly_scores: Per-row anomaly scores for the ``anomalies`` section.
    """
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "overview": overview(df),
        "patterns": patterns(df),
        "locations": locations(df),
        "segments": segments(df, segmenter_bundle),
        "anomalies": anomalies(df, anomaly_scores),
    }


def write_analytics(payload: dict, path: str | Path = ANALYTICS_JSON) -> Path:
    """Write the payload to ``path`` as pretty-printed JSON. Returns the path."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return path
