"""Application state: load every artifact once at startup, hold it for the request handlers.

``AppState.load()`` reads the five ``.joblib`` models, ``metrics.json`` and
``analytics.json``, the processed sessions parquet, and derives two things the API needs
that are not persisted directly: a per-session anomaly table (score + risk + reasons) and
an hourly demand series for the forecast endpoint.

If an artifact is missing, ``load`` raises ``ArtifactsMissing`` with a clear message
pointing at the scripts that create them.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field

import pandas as pd

from evcharging.config import (
    ANALYTICS_JSON,
    CLEAN_PARQUET,
    METRICS_JSON,
    MODELS_DIR,
)
from evcharging.models.anomaly import (
    HARD_FLAG_COLUMNS,
    anomaly_scores,
    explain_row,
)
from evcharging.models.anomaly import (
    prepare_matrix as anomaly_matrix,
)
from evcharging.models.common import load_artifact
from evcharging.models.demand import build_hourly_demand

_ARTIFACTS = [
    "energy_regressor.joblib",
    "duration_regressor.joblib",
    "session_segmenter.joblib",
    "session_anomaly.joblib",
    "demand_forecaster.joblib",
]


class ArtifactsMissing(RuntimeError):
    """Raised at startup when a model artifact or a processed-data file is not present."""


def _risk(score: float) -> str:
    if score >= 0.60:
        return "high"
    if score >= 0.40:
        return "medium"
    return "normal"


@dataclass
class AppState:
    energy_model: object
    duration_model: object
    segmenter_bundle: dict
    anomaly_bundle: dict
    demand_bundle: dict
    analytics: dict
    metrics: dict
    sessions: pd.DataFrame
    anomaly_table: pd.DataFrame
    hourly_demand: pd.DataFrame
    demand_by_hour: pd.Series = field(repr=False)

    @property
    def models_loaded(self) -> list[str]:
        return list(_ARTIFACTS)

    @classmethod
    def load(cls) -> AppState:
        missing = [name for name in _ARTIFACTS if not (MODELS_DIR / name).exists()]
        if missing:
            raise ArtifactsMissing(
                "missing model artifacts: "
                + ", ".join(missing)
                + " - run `python scripts/train_all.py`"
            )
        for path in (CLEAN_PARQUET, ANALYTICS_JSON):
            if not path.exists():
                raise ArtifactsMissing(
                    f"{path.name} not found - run `python scripts/prepare_data.py` "
                    "and `python scripts/build_analytics.py`"
                )

        sessions = pd.read_parquet(CLEAN_PARQUET)
        anomaly_bundle = load_artifact("session_anomaly.joblib")
        segmenter_bundle = load_artifact("session_segmenter.joblib")
        demand_bundle = load_artifact("demand_forecaster.joblib")

        # per-session anomaly table
        scores = anomaly_scores(anomaly_bundle["pipeline"], anomaly_matrix(sessions))
        reasons = sessions.apply(explain_row, axis=1)
        anomaly_table = pd.DataFrame({
            "index": range(len(sessions)),
            "station_id": sessions["station_id"].to_numpy(),
            "location": sessions["location"].to_numpy(),
            "vehicle_model": sessions["vehicle_model"].to_numpy(),
            "energy_kwh": sessions["energy_kwh"].to_numpy(),
            "battery_capacity_kwh": sessions["battery_capacity_kwh"].to_numpy(),
            "soc_delta_pct": sessions["soc_delta_pct"].to_numpy(),
            "anomaly_score": scores.round(4),
            "risk": [_risk(s) for s in scores],
            "reasons": reasons.to_numpy(),
            "breaks_hard_rule": sessions[HARD_FLAG_COLUMNS].any(axis=1).to_numpy(),
        }).sort_values("anomaly_score", ascending=False, ignore_index=True)

        hourly = build_hourly_demand(sessions)
        preds = demand_bundle["model"].predict(hourly[demand_bundle["features"]])
        demand_by_hour = (
            pd.Series(preds, index=hourly["hour"].to_numpy()).groupby(level=0).mean()
        )

        return cls(
            energy_model=load_artifact("energy_regressor.joblib"),
            duration_model=load_artifact("duration_regressor.joblib"),
            segmenter_bundle=segmenter_bundle,
            anomaly_bundle=anomaly_bundle,
            demand_bundle=demand_bundle,
            analytics=json.loads(ANALYTICS_JSON.read_text(encoding="utf-8")),
            metrics=json.loads(METRICS_JSON.read_text(encoding="utf-8")),
            sessions=sessions,
            anomaly_table=anomaly_table,
            hourly_demand=hourly,
            demand_by_hour=demand_by_hour,
        )
