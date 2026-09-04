"""Tests for evcharging.data.load."""

from __future__ import annotations

import pandas as pd
import pandas.api.types as ptypes

from evcharging.config import NUMERIC_COLS, TEMPERATURE_COL, TIMESTAMP_COLS


def test_row_count_and_no_drops(raw_df: pd.DataFrame) -> None:
    assert len(raw_df) == 1320
    assert raw_df["user_id"].nunique() == 1320  # one session per user


def test_columns_renamed(raw_df: pd.DataFrame) -> None:
    assert TEMPERATURE_COL in raw_df.columns
    assert not any(c.startswith("Charging ") for c in raw_df.columns)
    assert {"start_time", "end_time", "energy_kwh", "soc_start_pct"} <= set(raw_df.columns)


def test_timestamps_parsed(raw_df: pd.DataFrame) -> None:
    for col in TIMESTAMP_COLS:
        assert ptypes.is_datetime64_any_dtype(raw_df[col])


def test_numeric_columns_are_numeric(raw_df: pd.DataFrame) -> None:
    for col in NUMERIC_COLS:
        assert ptypes.is_numeric_dtype(raw_df[col])


def test_true_duration_is_positive(raw_df: pd.DataFrame) -> None:
    assert (raw_df["duration_hours"] > 0).all()
    # end - start, in hours, matches a direct recompute
    recomputed = (raw_df["end_time"] - raw_df["start_time"]).dt.total_seconds() / 3600
    assert (raw_df["duration_hours"] - recomputed).abs().max() < 1e-9


def test_expected_missing_value_counts(raw_df: pd.DataFrame) -> None:
    assert raw_df["energy_kwh"].isna().sum() == 66
    assert raw_df["charging_rate_kw"].isna().sum() == 66
    assert raw_df["distance_km"].isna().sum() == 66
