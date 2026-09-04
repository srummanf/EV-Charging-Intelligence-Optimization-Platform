"""Precompute the dashboard analytics payload.

Run from the repo root, after ``prepare_data.py`` and ``train_all.py``:

    python scripts/build_analytics.py

Reads ``data/processed/sessions_clean.parquet`` plus the segmenter and anomaly artifacts
(both optional), and writes ``data/processed/analytics.json`` - the single file the API's
``/analytics/*`` endpoints and the web dashboard read.
"""

from __future__ import annotations

import sys
from pathlib import Path

_SRC = Path(__file__).resolve().parents[1] / "src"
if _SRC.is_dir() and str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

import pandas as pd

from evcharging.analytics import build_analytics, write_analytics
from evcharging.config import ANALYTICS_JSON, CLEAN_PARQUET


def main() -> None:
    if not CLEAN_PARQUET.exists():
        raise SystemExit(
            f"{CLEAN_PARQUET} not found - run `python scripts/prepare_data.py` first."
        )
    df = pd.read_parquet(CLEAN_PARQUET)

    segmenter_bundle = None
    anomaly_scores = None
    try:
        from evcharging.models.common import load_artifact

        segmenter_bundle = load_artifact("session_segmenter.joblib")
    except FileNotFoundError:
        print("note: session_segmenter.joblib missing - 'segments' section will be empty")
    try:
        from evcharging.models.anomaly import fit_anomaly

        anomaly_scores = fit_anomaly(df).scores
    except FileNotFoundError:
        print("note: anomaly model unavailable - 'anomalies' section will be empty")

    payload = build_analytics(df, segmenter_bundle, anomaly_scores)
    write_analytics(payload)

    ov = payload["overview"]
    print(f"sessions        {ov['n_sessions']:,}")
    print(f"total energy    {ov['total_energy_kwh']:,.0f} kWh")
    print(f"peak hour       {ov['peak_hour']:02d}:00")
    print(f"top location    {ov['highest_demand_location']}")
    print(f"segments        {len(payload['segments'])}")
    print(f"anomaly high    {payload['anomalies'].get('n_high_risk', 0)}")
    print(f"wrote {ANALYTICS_JSON.relative_to(ANALYTICS_JSON.parents[2])}")


if __name__ == "__main__":
    main()
