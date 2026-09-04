"""Tests for evcharging.features.build."""

from __future__ import annotations

import numpy as np
import pandas as pd

from evcharging.features.build import (
    add_consistency_features,
    add_encodings,
    add_time_parts,
    build_features,
    impute_predictors,
)


def test_time_parts_ranges_and_no_nans(raw_df: pd.DataFrame) -> None:
    out = add_time_parts(raw_df)
    assert out["hour"].between(0, 23).all()
    assert out["weekday"].between(0, 6).all()
    assert set(out["month"].unique()) <= {1, 2}
    assert out["is_weekend"].isin([0, 1]).all()
    assert (out["is_weekend"] == (out["weekday"] >= 5).astype(int)).all()
    for col in ["hour", "weekday", "day_name", "month", "is_weekend"]:
        assert out[col].isna().sum() == 0


def test_soc_delta_matches_definition(raw_df: pd.DataFrame) -> None:
    out = add_consistency_features(raw_df)
    expected = raw_df["soc_end_pct"] - raw_df["soc_start_pct"]
    assert (out["soc_delta_pct"] - expected).abs().max() < 1e-9


def test_consistency_ratios_have_no_infinities(raw_df: pd.DataFrame) -> None:
    out = add_consistency_features(raw_df)
    for col in [
        "power_consistency_ratio",
        "soc_energy_consistency_ratio",
        "duration_consistency_ratio",
        "energy_per_km",
        "implied_power_kw",
    ]:
        assert not np.isinf(out[col].to_numpy(dtype="float64", na_value=np.nan)).any()


def test_encodings_present(raw_df: pd.DataFrame) -> None:
    out = add_encodings(raw_df)
    assert "vehicle_model_Tesla Model 3" in out.columns
    assert "location_New York" in out.columns
    assert "user_type_Commuter" in out.columns
    # ordinal code follows Level 1 < Level 2 < DC Fast Charger
    codes = out.groupby("charger_type")["charger_type_code"].first()
    assert codes["Level 1"] < codes["Level 2"] < codes["DC Fast Charger"]


def test_build_features_preserves_rows(raw_df: pd.DataFrame) -> None:
    out = build_features(raw_df)
    assert len(out) == len(raw_df)
    assert list(out["user_id"]) == list(raw_df["user_id"])


def test_impute_predictors_fills_gaps() -> None:
    df = pd.DataFrame(
        {
            "a": [1.0, np.nan, 3.0],
            "cat": ["x", None, "y"],
        }
    )
    out = impute_predictors(df, numeric_cols=["a"], categorical_cols=["cat"])
    assert out["a"].isna().sum() == 0
    assert out.loc[1, "a"] == 2.0  # median of [1, 3]
    assert out.loc[1, "cat"] == "unknown"
