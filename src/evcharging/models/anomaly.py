"""Anomaly detection - score how physically implausible a charging session looks.

Module E, and the part of the project where domain knowledge and ML meet. Phase 1 built
nine hard validation rules. Here an Isolation Forest learns the *shape* of a normal
session from the physical-consistency features, producing a continuous
``anomaly_score`` in [0, 1] that also ranks the merely unusual, not just the
rule-breaking. The score is then reconciled against the hard rules so we can state its
precision and recall.

> **Isolation Forest**
>
> An Isolation Forest builds many random trees that split the data on random features at
> random thresholds. Points that get isolated in very few splits are, by construction,
> far from the bulk of the data and are scored as anomalies. It needs no labels and
> handles the heavy-tailed consistency ratios well because it only looks at split
> counts, not distances.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from evcharging.config import RANDOM_STATE
from evcharging.data.validate import FLAG_DESCRIPTIONS
from evcharging.features import impute_predictors

# The features the model scores on: the three consistency ratios, two derived physical
# quantities, the SOC swing, and the two raw values behind the "energy exceeds capacity"
# rule so that violation is directly learnable.
ANOMALY_FEATURES = [
    "power_consistency_ratio",
    "soc_energy_consistency_ratio",
    "duration_consistency_ratio",
    "implied_power_kw",
    "energy_per_km",
    "soc_delta_pct",
    "energy_capacity_ratio",
]

# Hard, unambiguous physical violations - the ground truth the ML score is checked
# against. The two "these columns disagree" statistical rules are left out on purpose;
# they are what the model is meant to weigh, not a label.
HARD_FLAG_COLUMNS = [
    "flag_energy_exceeds_capacity",
    "flag_soc_not_increasing",
    "flag_soc_out_of_range",
    "flag_battery_capacity_out_of_range",
    "flag_temperature_out_of_range",
]


def prepare_matrix(df: pd.DataFrame) -> pd.DataFrame:
    """Return the anomaly feature matrix, median-imputed and finite.

    ``energy_capacity_ratio`` = ``energy_kwh / battery_capacity_kwh`` is derived here so
    the "energy exceeds capacity" violation (ratio > 1) sits on a single axis the
    Isolation Forest can split on directly.
    """
    out = df.copy()
    with np.errstate(divide="ignore", invalid="ignore"):
        out["energy_capacity_ratio"] = out["energy_kwh"] / out["battery_capacity_kwh"]

    X = out[ANOMALY_FEATURES].copy()
    X = X.replace([np.inf, -np.inf], np.nan)
    X = impute_predictors(X, numeric_cols=ANOMALY_FEATURES)
    return X.astype(float)


def make_model(contamination: float = 0.2, random_state: int = RANDOM_STATE) -> Pipeline:
    """A ``StandardScaler`` -> ``IsolationForest`` pipeline.

    The scaler does not change the tree splits but keeps the pipeline uniform with the
    other models. ``contamination`` is the assumed anomaly fraction; it sets where
    ``predict`` draws the in/out boundary but not the continuous score.
    """
    return Pipeline(
        [
            ("scale", StandardScaler()),
            (
                "iforest",
                IsolationForest(
                    n_estimators=300,
                    contamination=contamination,
                    random_state=random_state,
                    n_jobs=-1,
                ),
            ),
        ]
    )


def anomaly_scores(pipeline: Pipeline, X: pd.DataFrame) -> np.ndarray:
    """Map the Isolation Forest output to ``[0, 1]``, higher = more anomalous.

    ``score_samples`` returns higher values for normal points; we negate it and min-max
    scale to [0, 1] so the number reads directly as "how anomalous".
    """
    raw = -pipeline.named_steps["iforest"].score_samples(
        pipeline.named_steps["scale"].transform(X)
    )
    lo, hi = raw.min(), raw.max()
    return (raw - lo) / (hi - lo) if hi > lo else np.zeros_like(raw)


def _ratio_reasons(row: pd.Series) -> list[str]:
    """Plain-language notes for consistency ratios that sit far from 1.0."""
    reasons = []
    pcr = row.get("power_consistency_ratio")
    if pd.notna(pcr) and (pcr < 0.5 or pcr > 2.0):
        reasons.append("charging rate x duration does not match the energy delivered")
    ser = row.get("soc_energy_consistency_ratio")
    if pd.notna(ser) and (ser < 0.5 or ser > 2.0):
        reasons.append("state-of-charge gain does not match the energy delivered")
    dcr = row.get("duration_consistency_ratio")
    if pd.notna(dcr) and (dcr < 0.5 or dcr > 2.0):
        reasons.append("reported duration is far from the timestamped duration")
    epk = row.get("energy_per_km")
    if pd.notna(epk) and epk > 1.0:
        reasons.append("energy per km driven is implausibly high")
    return reasons


def explain_row(row: pd.Series) -> str:
    """Build a reason string for one session from its validation flags and ratios.

    Hard-rule violations are listed first (they are certain), then the softer
    ratio-based notes. Returns ``"no rule violations"`` when nothing fires.
    """
    reasons = [
        FLAG_DESCRIPTIONS[col]
        for col in FLAG_DESCRIPTIONS
        if col in row.index and bool(row[col])
    ]
    reasons += _ratio_reasons(row)
    return "; ".join(reasons) if reasons else "no rule violations"


@dataclass
class Reconciliation:
    threshold: float
    n_flagged_ml: int
    n_flagged_rules: int
    precision: float
    recall: float
    f1: float

    def as_dict(self) -> dict:
        return {
            "score_threshold": round(self.threshold, 4),
            "n_flagged_ml": self.n_flagged_ml,
            "n_flagged_hard_rules": self.n_flagged_rules,
            "precision_vs_hard_rules": round(self.precision, 4),
            "recall_vs_hard_rules": round(self.recall, 4),
            "f1_vs_hard_rules": round(self.f1, 4),
        }


def reconcile(df: pd.DataFrame, scores: np.ndarray, threshold: float) -> Reconciliation:
    """Compare ``scores >= threshold`` against the hard validation rules.

    - **Precision** - of the sessions the model flags, the share that break a hard rule.
    - **Recall** - of the sessions that break a hard rule, the share the model flags.

    A high-precision, lower-recall result is expected and fine: the model should catch
    the clear violations plus some extra oddities, not reproduce the rules exactly.
    """
    ml_flag = scores >= threshold
    rule_flag = df[HARD_FLAG_COLUMNS].any(axis=1).to_numpy()

    tp = int((ml_flag & rule_flag).sum())
    precision = tp / ml_flag.sum() if ml_flag.sum() else 0.0
    recall = tp / rule_flag.sum() if rule_flag.sum() else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0

    return Reconciliation(
        threshold=float(threshold),
        n_flagged_ml=int(ml_flag.sum()),
        n_flagged_rules=int(rule_flag.sum()),
        precision=precision,
        recall=recall,
        f1=f1,
    )


@dataclass
class AnomalyResult:
    pipeline: Pipeline
    contamination: float
    scores: np.ndarray
    threshold: float
    reasons: pd.Series
    reconciliation: Reconciliation

    def metrics_payload(self) -> dict:
        return {
            "model": "IsolationForest",
            "n_estimators": 300,
            "contamination": self.contamination,
            "features": ANOMALY_FEATURES,
            "hard_rule_columns": HARD_FLAG_COLUMNS,
            "score_threshold": round(self.threshold, 4),
            "reconciliation": self.reconciliation.as_dict(),
        }


def fit_anomaly(
    df: pd.DataFrame, contamination: float = 0.2, random_state: int = RANDOM_STATE
) -> AnomalyResult:
    """Fit the Isolation Forest, score every row, build reasons, and reconcile."""
    X = prepare_matrix(df)
    pipeline = make_model(contamination, random_state)
    pipeline.fit(X)

    scores = anomaly_scores(pipeline, X)
    threshold = float(np.quantile(scores, 1 - contamination))

    reason_source = df.join(X[["power_consistency_ratio", "soc_energy_consistency_ratio",
                               "duration_consistency_ratio", "energy_per_km"]],
                            rsuffix="_imp")
    reasons = reason_source.apply(explain_row, axis=1)

    recon = reconcile(df, scores, threshold)
    return AnomalyResult(
        pipeline=pipeline,
        contamination=contamination,
        scores=scores,
        threshold=threshold,
        reasons=reasons,
        reconciliation=recon,
    )


def train(df: pd.DataFrame | None = None, contamination: float = 0.2, persist: bool = True):
    """Fit on the processed sessions and optionally persist the model + metrics."""
    from evcharging.config import CLEAN_PARQUET
    from evcharging.models.common import save_artifact, write_metrics

    if df is None:
        df = pd.read_parquet(CLEAN_PARQUET)

    result = fit_anomaly(df, contamination=contamination)

    if persist:
        save_artifact(
            {"pipeline": result.pipeline, "threshold": result.threshold,
             "features": ANOMALY_FEATURES},
            "session_anomaly.joblib",
        )
        write_metrics("anomaly", result.metrics_payload())

    return result


if __name__ == "__main__":
    res = train()
    print(f"threshold={res.threshold:.3f}  "
          f"ML-flagged={res.reconciliation.n_flagged_ml}  "
          f"hard-rule={res.reconciliation.n_flagged_rules}")
    print(f"precision={res.reconciliation.precision:.3f}  "
          f"recall={res.reconciliation.recall:.3f}  f1={res.reconciliation.f1:.3f}")
