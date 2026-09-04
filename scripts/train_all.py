"""Train every Phase 2 model and refresh the artifacts in ``models/``.

Run from the repo root:

    python scripts/train_all.py
    python scripts/train_all.py --track      # also log runs to MLflow

Each model is a self-contained section that loads the processed sessions, evaluates,
persists a ``.joblib`` artifact, and updates its own section of ``models/metrics.json``.
The processed dataset must exist first (``python scripts/prepare_data.py``).
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

_SRC = Path(__file__).resolve().parents[1] / "src"
if _SRC.is_dir() and str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

import pandas as pd

from evcharging.analytics import build_analytics, write_analytics
from evcharging.config import ANALYTICS_JSON, CLEAN_PARQUET, METRICS_JSON
from evcharging.models import anomaly, demand, duration, energy, segmentation


def _header(title: str) -> None:
    print(f"\n{'=' * 70}\n{title}\n{'=' * 70}")


def _flatten(prefix: str, obj: dict) -> dict[str, float]:
    """Flatten a nested metrics dict to ``{"a.b.c": number}`` for MLflow."""
    out: dict[str, float] = {}
    for key, value in obj.items():
        name = f"{prefix}.{key}" if prefix else str(key)
        if isinstance(value, dict):
            out.update(_flatten(name, value))
        elif isinstance(value, (int, float)) and not isinstance(value, bool):
            out[name] = float(value)
    return out


class _Tracker:
    """Thin MLflow wrapper. A no-op unless ``--track`` is passed.

    Uses ``MLFLOW_TRACKING_URI`` if set, otherwise a local ``sqlite:///mlflow.db`` -
    recent MLflow deprecates the bare-directory file store. Browse runs with
    ``mlflow ui --backend-store-uri sqlite:///mlflow.db``.
    """

    def __init__(self, enabled: bool):
        self.enabled = enabled
        self._mlflow = None
        if enabled:
            import os

            try:
                import mlflow
            except ImportError as exc:  # pragma: no cover
                raise SystemExit(
                    "--track needs MLflow: pip install -e '.[tracking]'"
                ) from exc
            self._mlflow = mlflow
            mlflow.set_tracking_uri(
                os.getenv("MLFLOW_TRACKING_URI", "sqlite:///mlflow.db")
            )
            mlflow.set_experiment("evcharging")

    def log(self, name: str, payload: dict, artifact: str | None = None) -> None:
        if not self.enabled:
            return
        with self._mlflow.start_run(run_name=name):
            self._mlflow.log_params(
                {k: v for k, v in payload.items() if isinstance(v, (str, bool))}
            )
            self._mlflow.log_metrics(_flatten("", payload))
            self._mlflow.log_dict(payload, f"{name}_metrics.json")
            if artifact and (Path("models") / artifact).exists():
                self._mlflow.log_artifact(str(Path("models") / artifact))


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--track", action="store_true", help="log params/metrics/artifacts to MLflow"
    )
    args = parser.parse_args(argv)
    tracker = _Tracker(args.track)

    if not CLEAN_PARQUET.exists():
        raise SystemExit(
            f"{CLEAN_PARQUET} not found - run `python scripts/prepare_data.py` first."
        )

    df = pd.read_parquet(CLEAN_PARQUET)
    print(f"loaded {len(df):,} sessions from {CLEAN_PARQUET.name}")
    if args.track:
        print("MLflow tracking enabled (experiment: evcharging)")
    started = time.time()

    _header("Energy regressor  (target: energy_kwh)")
    e = energy.train(df)
    for rep in e.reports.values():
        print("  " + rep.summary_row())
    print(f"  -> best: {e.best_name}")
    tracker.log("energy", e.metrics_payload(), energy.ARTIFACT_NAME)

    _header("Duration regressor  (target: duration_hours)")
    d = duration.train(df)
    for rep in d.reports.values():
        print("  " + rep.summary_row())
    print(f"  -> best: {d.best_name}")
    tracker.log("duration", d.metrics_payload(), duration.ARTIFACT_NAME)

    _header("Session segmentation  (KMeans)")
    seg, search = segmentation.train(df)
    print(search.as_frame().round(3).to_string())
    print(f"  -> k = {seg.k}, silhouette = {seg.silhouette:.3f}")
    for cluster, name in seg.archetypes.items():
        print(f"     cluster {cluster}: {name} (n={seg.profile.loc[cluster, 'n_sessions']})")
    tracker.log("segmentation", seg.metrics_payload(), "session_segmenter.joblib")

    _header("Anomaly detection  (IsolationForest)")
    a = anomaly.train(df)
    rc = a.reconciliation
    print(f"  ML-flagged {rc.n_flagged_ml}, hard-rule {rc.n_flagged_rules}")
    print(f"  precision {rc.precision:.3f}  recall {rc.recall:.3f}  f1 {rc.f1:.3f}")
    tracker.log("anomaly", a.metrics_payload(), "session_anomaly.joblib")

    _header("Demand forecasting  (GradientBoosting, walk-forward)")
    dem, hourly, _ = demand.train(df)
    print(f"  hourly points: {len(hourly)}")
    print(f"  model          MAE {dem.model_metrics['mae']:.2f}")
    print(f"  mean baseline  MAE {dem.mean_baseline_metrics['mae']:.2f}")
    print(f"  seasonal-naive MAE {dem.seasonal_naive_metrics['mae']:.2f}")
    tracker.log("demand", dem.metrics_payload(), "demand_forecaster.joblib")

    _header("Dashboard analytics  (precomputed payload)")
    seg_bundle = {"pipeline": seg.pipeline, "archetypes": seg.archetypes}
    payload = build_analytics(df, seg_bundle, a.scores)
    write_analytics(payload)
    sections = [k for k in payload if k != "generated_at"]
    print(f"  {', '.join(sections)} -> {ANALYTICS_JSON.name}")

    _header(f"Done in {time.time() - started:.1f}s")
    print(f"artifacts + {METRICS_JSON.name} + {ANALYTICS_JSON.name} refreshed")


if __name__ == "__main__":
    main()
