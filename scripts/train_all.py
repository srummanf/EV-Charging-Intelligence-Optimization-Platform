"""Train every Phase 2 model and refresh the artifacts in ``models/``.

Run from the repo root:

    python scripts/train_all.py

Each model is a self-contained section that loads the processed sessions, evaluates,
persists a ``.joblib`` artifact, and updates its own section of ``models/metrics.json``.
The processed dataset must exist first (``python scripts/prepare_data.py``).
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

_SRC = Path(__file__).resolve().parents[1] / "src"
if _SRC.is_dir() and str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

import pandas as pd

from evcharging.config import CLEAN_PARQUET, METRICS_JSON
from evcharging.models import anomaly, demand, duration, energy, segmentation


def _header(title: str) -> None:
    print(f"\n{'=' * 70}\n{title}\n{'=' * 70}")


def main() -> None:
    if not CLEAN_PARQUET.exists():
        raise SystemExit(
            f"{CLEAN_PARQUET} not found - run `python scripts/prepare_data.py` first."
        )

    df = pd.read_parquet(CLEAN_PARQUET)
    print(f"loaded {len(df):,} sessions from {CLEAN_PARQUET.name}")
    started = time.time()

    _header("Energy regressor  (target: energy_kwh)")
    e = energy.train(df)
    for rep in e.reports.values():
        print("  " + rep.summary_row())
    print(f"  -> best: {e.best_name}")

    _header("Duration regressor  (target: duration_hours)")
    d = duration.train(df)
    for rep in d.reports.values():
        print("  " + rep.summary_row())
    print(f"  -> best: {d.best_name}")

    _header("Session segmentation  (KMeans)")
    seg, search = segmentation.train(df)
    print(search.as_frame().round(3).to_string())
    print(f"  -> k = {seg.k}, silhouette = {seg.silhouette:.3f}")
    for cluster, name in seg.archetypes.items():
        print(f"     cluster {cluster}: {name} (n={seg.profile.loc[cluster, 'n_sessions']})")

    _header("Anomaly detection  (IsolationForest)")
    a = anomaly.train(df)
    rc = a.reconciliation
    print(f"  ML-flagged {rc.n_flagged_ml}, hard-rule {rc.n_flagged_rules}")
    print(f"  precision {rc.precision:.3f}  recall {rc.recall:.3f}  f1 {rc.f1:.3f}")

    _header("Demand forecasting  (GradientBoosting, walk-forward)")
    dem, hourly, _ = demand.train(df)
    print(f"  hourly points: {len(hourly)}")
    print(f"  model          MAE {dem.model_metrics['mae']:.2f}")
    print(f"  mean baseline  MAE {dem.mean_baseline_metrics['mae']:.2f}")
    print(f"  seasonal-naive MAE {dem.seasonal_naive_metrics['mae']:.2f}")

    _header(f"Done in {time.time() - started:.1f}s")
    print(f"artifacts + {METRICS_JSON.name} refreshed in {METRICS_JSON.parent}")


if __name__ == "__main__":
    main()
