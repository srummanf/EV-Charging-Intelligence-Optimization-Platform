"""Shared training logic for the two regression models (energy and duration).

Both models have the same shape - a continuous target, the same pre-session predictors,
the same four-model line-up (mean baseline, linear regression, random forest, XGBoost),
the same 5-fold evaluation - so the mechanics live here and
:mod:`evcharging.models.energy` / :mod:`evcharging.models.duration` only supply the
target column and a short description.

"Pre-session predictors" means quantities known *before* the session starts: the
vehicle, the battery, the requested state-of-charge swing, the distance since last
charge, the weather, and the calendar slot. Measured-during-the-session columns
(``charging_rate_kw``, the reported duration, the cost) are deliberately excluded so the
models stay usable by the recommendation engine and do not leak the answer.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

import pandas as pd
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBRegressor

from evcharging.config import RANDOM_STATE
from evcharging.features import impute_predictors
from evcharging.models.common import (
    RegressionReport,
    kfold_regression,
    regression_metrics,
)

# Predictors shared by both regressors. One-hot columns are pulled in by prefix.
NUMERIC_PREDICTORS = [
    "battery_capacity_kwh",
    "soc_start_pct",
    "soc_end_pct",
    "soc_delta_pct",
    "distance_km",
    "temperature_c",
    "vehicle_age_years",
    "charger_type_code",
    "hour",
    "weekday",
    "is_weekend",
]
ONE_HOT_PREFIXES = ["vehicle_model_", "location_", "user_type_"]


def predictor_columns(df: pd.DataFrame) -> list[str]:
    """The full predictor list for ``df``: the numeric columns plus every one-hot column."""
    one_hot = [c for c in df.columns if c.startswith(tuple(ONE_HOT_PREFIXES))]
    return NUMERIC_PREDICTORS + sorted(one_hot)


def make_model_factories(
    random_state: int = RANDOM_STATE,
) -> dict[str, Callable[[], object]]:
    """Return ``name -> zero-arg factory`` for the four regressors.

    Factories (not instances) so every CV fold and every notebook gets a clean, unfitted
    model. Linear regression is wrapped in a scaler; the tree models do not need one.
    """
    return {
        "baseline_mean": lambda: DummyRegressor(strategy="mean"),
        "linear_regression": lambda: Pipeline(
            [("scale", StandardScaler()), ("lr", LinearRegression())]
        ),
        "random_forest": lambda: RandomForestRegressor(
            n_estimators=300,
            max_depth=None,
            min_samples_leaf=2,
            random_state=random_state,
            n_jobs=-1,
        ),
        "xgboost": lambda: XGBRegressor(
            n_estimators=400,
            learning_rate=0.05,
            max_depth=4,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=random_state,
            n_jobs=-1,
        ),
    }


def prepare_xy(df: pd.DataFrame, target: str) -> tuple[pd.DataFrame, pd.Series]:
    """Build ``(X, y)`` for a regression target from the processed sessions frame.

    Steps, matching the Phase-1 missing-value policy:

    1. Drop rows where ``target`` is missing.
    2. Take the predictor columns.
    3. Median-impute any remaining numeric predictor gaps (``distance_km`` mainly), on
       this modelling subset only.

    Returns the feature frame and the aligned target, both with a clean 0..n-1 index.
    """
    subset = df.dropna(subset=[target]).reset_index(drop=True)
    cols = predictor_columns(subset)
    X = subset[cols].copy()
    X = impute_predictors(X, numeric_cols=[c for c in NUMERIC_PREDICTORS if c in X])
    X = X.astype(float)
    y = subset[target].astype(float)
    return X, y


@dataclass
class RegressionSuiteResult:
    """Everything a training run produces for one regression target."""

    target: str
    n_rows: int
    n_features: int
    reports: dict[str, RegressionReport]
    best_name: str
    best_estimator: object  # fitted on all rows
    refit_metrics: dict[str, float]  # best model scored on its own training data

    def metrics_payload(self) -> dict:
        return {
            "target": self.target,
            "n_rows": self.n_rows,
            "n_features": self.n_features,
            "cv": {name: rep.as_dict() for name, rep in self.reports.items()},
            "best_model": self.best_name,
            "selected_by": "lowest mean 5-fold MAE",
            "refit_on_full_data": {k: round(v, 4) for k, v in self.refit_metrics.items()},
        }


def run_suite(
    df: pd.DataFrame,
    target: str,
    n_splits: int = 5,
    random_state: int = RANDOM_STATE,
) -> RegressionSuiteResult:
    """Cross-validate all four models on ``target``, then refit the best on all rows.

    "Best" is the lowest mean 5-fold MAE. The returned ``best_estimator`` is already
    fitted on the full modelling subset and is what gets persisted as the ``.joblib``
    artifact.
    """
    X, y = prepare_xy(df, target)
    factories = make_model_factories(random_state)

    reports = {
        name: kfold_regression(name, factory, X, y, n_splits=n_splits, random_state=random_state)
        for name, factory in factories.items()
    }

    best_name = min(reports, key=lambda n: reports[n].mean["mae"])
    best_estimator = factories[best_name]()
    best_estimator.fit(X, y)
    refit_metrics = regression_metrics(y, best_estimator.predict(X))

    return RegressionSuiteResult(
        target=target,
        n_rows=len(X),
        n_features=X.shape[1],
        reports=reports,
        best_name=best_name,
        best_estimator=best_estimator,
        refit_metrics=refit_metrics,
    )


def shap_summary_values(estimator, X: pd.DataFrame, max_samples: int = 400,
                        random_state: int = RANDOM_STATE):
    """Return ``(shap_values, X_sample)`` for a tree model, for a summary plot.

    Uses :class:`shap.TreeExplainer`, which is exact and fast for random forests and
    XGBoost. A random sample keeps the plot readable and quick. Import of ``shap`` is
    local so the package is only needed when this is actually called.
    """
    import shap

    sample = X.sample(min(max_samples, len(X)), random_state=random_state)
    explainer = shap.TreeExplainer(estimator)
    values = explainer.shap_values(sample)
    return values, sample
