"""Duration regressor - predict the true session length in hours.

Module C of the platform. The target is ``duration_hours`` (``end_time - start_time``),
never the unreliable reported column. Same pre-session predictors and same four-model
line-up as the energy regressor; the recommendation engine uses the prediction to quote
an expected charging time and to place the charging window.
"""

from __future__ import annotations

import pandas as pd

from evcharging.config import CLEAN_PARQUET
from evcharging.models.common import save_artifact, write_metrics
from evcharging.models.regression import RegressionSuiteResult, run_suite

TARGET = "duration_hours"
ARTIFACT_NAME = "duration_regressor.joblib"
METRICS_KEY = "duration"


def train(df: pd.DataFrame | None = None, persist: bool = True) -> RegressionSuiteResult:
    """Cross-validate the four models on ``duration_hours`` and refit the best.

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
