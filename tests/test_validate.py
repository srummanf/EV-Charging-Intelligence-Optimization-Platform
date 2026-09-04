"""Tests for evcharging.data.validate."""

from __future__ import annotations

import pandas as pd
import pandas.api.types as ptypes

from evcharging.data.validate import (
    FLAG_COLUMNS,
    add_validation_flags,
    build_validation_report,
)


def test_flags_are_boolean_and_complete(raw_df: pd.DataFrame) -> None:
    flagged = add_validation_flags(raw_df)
    for col in [*FLAG_COLUMNS, "flag_any"]:
        assert col in flagged.columns
        assert ptypes.is_bool_dtype(flagged[col])
        assert flagged[col].isna().sum() == 0


def test_does_not_mutate_input(raw_df: pd.DataFrame) -> None:
    before = set(raw_df.columns)
    add_validation_flags(raw_df)
    assert set(raw_df.columns) == before


def test_known_rule_counts(raw_df: pd.DataFrame) -> None:
    flagged = add_validation_flags(raw_df)
    assert flagged["flag_energy_exceeds_capacity"].sum() == 190
    assert flagged["flag_soc_not_increasing"].sum() == 268
    assert flagged["flag_soc_out_of_range"].sum() == 32


def test_flag_any_is_the_or_of_the_rules(raw_df: pd.DataFrame) -> None:
    flagged = add_validation_flags(raw_df)
    assert (flagged["flag_any"] == flagged[FLAG_COLUMNS].any(axis=1)).all()


def test_report_shape(raw_df: pd.DataFrame) -> None:
    report = build_validation_report(raw_df)
    assert report["n_rows"] == 1320
    assert set(report["rules"]) == set(FLAG_COLUMNS)
    for rule in report["rules"].values():
        assert 0 <= rule["pct"] <= 100
        assert rule["count"] >= 0
    assert set(report["missing_values"]) == {"energy_kwh", "charging_rate_kw", "distance_km"}
