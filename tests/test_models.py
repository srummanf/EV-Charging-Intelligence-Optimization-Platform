"""Tests for the Phase 2 model modules.

These check plumbing and contracts (shapes, ranges, determinism, no leakage of missing
values), not model quality - the quality story is told honestly in the notebooks.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from evcharging.features import build_features
from evcharging.models import anomaly, demand, segmentation
from evcharging.models.common import kfold_regression, regression_metrics
from evcharging.models.regression import make_model_factories, prepare_xy, run_suite


@pytest.fixture(scope="module")
def features_df(raw_df: pd.DataFrame) -> pd.DataFrame:
    from evcharging.data import add_validation_flags

    return add_validation_flags(build_features(raw_df))


# --- common -------------------------------------------------------------------------

def test_regression_metrics_on_perfect_prediction() -> None:
    y = np.array([1.0, 2.0, 3.0, 4.0])
    m = regression_metrics(y, y)
    assert m["mae"] == 0 and m["rmse"] == 0 and m["r2"] == 1.0


def test_kfold_is_deterministic(features_df: pd.DataFrame) -> None:
    X, y = prepare_xy(features_df, "energy_kwh")
    factory = make_model_factories()["random_forest"]
    a = kfold_regression("rf", factory, X, y, n_splits=3)
    b = kfold_regression("rf", factory, X, y, n_splits=3)
    assert a.mean["mae"] == pytest.approx(b.mean["mae"], rel=1e-9)


# --- regression --------------------------------------------------------------------

def test_prepare_xy_drops_missing_target_and_imputes(features_df: pd.DataFrame) -> None:
    X, y = prepare_xy(features_df, "energy_kwh")
    assert len(X) == len(y) == features_df["energy_kwh"].notna().sum()
    assert X.isna().sum().sum() == 0
    assert y.notna().all()


def test_prepare_xy_excludes_leaky_columns(features_df: pd.DataFrame) -> None:
    X, _ = prepare_xy(features_df, "energy_kwh")
    for leak in ["charging_rate_kw", "duration_hours_reported", "cost_usd", "energy_kwh"]:
        assert leak not in X.columns


def test_run_suite_reports_all_models_and_refits(features_df: pd.DataFrame) -> None:
    result = run_suite(features_df, "duration_hours", n_splits=3)
    assert set(result.reports) == {
        "baseline_mean", "linear_regression", "random_forest", "xgboost"
    }
    # best estimator is fitted and usable
    preds = result.best_estimator.predict(
        prepare_xy(features_df, "duration_hours")[0].head()
    )
    assert len(preds) == 5


# --- segmentation -----------------------------------------------------------------

def test_segmentation_labels_every_session(features_df: pd.DataFrame) -> None:
    result = segmentation.fit_segmentation(features_df, k=4)
    assert len(result.labels) == len(features_df)
    assert set(np.unique(result.labels)) == {0, 1, 2, 3}
    assert len(result.archetypes) == 4
    assert result.profile["n_sessions"].sum() == len(features_df)


def test_segmentation_k_search_and_choice(features_df: pd.DataFrame) -> None:
    X = segmentation.prepare_matrix(features_df)
    search = segmentation.search_k(X, k_values=range(2, 6))
    assert list(search.as_frame().index) == [2, 3, 4, 5]
    # inertia decreases monotonically with k
    assert all(np.diff(search.inertia) < 0)
    # flat silhouette -> falls back to the default k
    assert segmentation.choose_k(search, flat_tol=1.0, default_k=4) == 4


# --- anomaly ---------------------------------------------------------------------

def test_anomaly_scores_in_unit_interval(features_df: pd.DataFrame) -> None:
    result = anomaly.fit_anomaly(features_df, contamination=0.2)
    assert result.scores.min() >= 0.0 and result.scores.max() <= 1.0
    assert len(result.scores) == len(features_df)
    assert len(result.reasons) == len(features_df)


def test_anomaly_reconciliation_bounds(features_df: pd.DataFrame) -> None:
    result = anomaly.fit_anomaly(features_df, contamination=0.2)
    rc = result.reconciliation
    assert 0.0 <= rc.precision <= 1.0
    assert 0.0 <= rc.recall <= 1.0


def test_anomaly_reasons_mention_violations(features_df: pd.DataFrame) -> None:
    result = anomaly.fit_anomaly(features_df, contamination=0.2)
    joined = features_df.assign(_r=result.reasons.to_numpy())
    # a row that exceeds capacity must say so
    bad = joined[joined["flag_energy_exceeds_capacity"]].iloc[0]
    assert "battery capacity" in bad["_r"]


# --- demand --------------------------------------------------------------------

def test_hourly_demand_is_complete_and_lagged(features_df: pd.DataFrame) -> None:
    hourly = demand.build_hourly_demand(features_df)
    assert hourly[demand.DEMAND_FEATURES].isna().sum().sum() == 0
    assert hourly["energy_kwh"].notna().all()
    # a regular one-hour index
    gaps = hourly.index.to_series().diff().dropna().unique()
    assert len(gaps) == 1 and gaps[0] == pd.Timedelta(hours=1)


def test_walk_forward_beats_seasonal_naive(features_df: pd.DataFrame) -> None:
    hourly = demand.build_hourly_demand(features_df)
    result = demand.walk_forward(hourly, n_splits=4)
    # not a quality claim about the world - just that on this noise series the GBM
    # does not do worse than repeating yesterday
    assert result.model_metrics["mae"] <= result.seasonal_naive_metrics["mae"]
    assert len(result.predictions) > 0
