"""Energy regressor - predict ``energy_kwh`` for a charging session.

Module B of the platform. Given the vehicle, battery, requested SOC swing, distance,
weather and calendar slot, predict how many kWh the session will deliver. The output
feeds the cost estimate and the recommendation engine.

The heavy lifting is in :mod:`evcharging.models.regression`; this module only pins the
target, the artifact name, and a ``train`` entry point.
"""

from __future__ import annotations

import pandas as pd

from evcharging.config import CLEAN_PARQUET
from evcharging.models.common import save_artifact, write_metrics
from evcharging.models.regression import RegressionSuiteResult, run_suite

TARGET = "energy_kwh"
ARTIFACT_NAME = "energy_regressor.joblib"
METRICS_KEY = "energy"


def train(df: pd.DataFrame | None = None, persist: bool = True) -> RegressionSuiteResult:
    """Cross-validate the four models on ``energy_kwh`` and refit the best.

    Args:
        df: Processed sessions frame. Loaded from ``sessions_clean.parquet`` if omitted.
        persist: If true, write the ``.joblib`` artifact and update ``metrics.json``.
    """
    if df is None:
        df = pd.read_parquet(CLEAN_PARQUET)

    result = run_suite(df, TARGET)

    if persist:
        save_artifact(result.best_estimator, ARTIFACT_NAME)
        write_metrics(METRICS_KEY, result.metrics_payload())

    return result


if __name__ == "__main__":
    res = train()
    print(f"best: {res.best_name}")
    for report in res.reports.values():
        print("  " + report.summary_row())
