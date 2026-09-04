"""Tests for evcharging.analytics.aggregate."""

from __future__ import annotations

import json

import numpy as np
import pandas as pd
import pytest

from evcharging.analytics import build_analytics, locations, overview, patterns
from evcharging.analytics.aggregate import anomalies, segments
from evcharging.data import add_validation_flags
from evcharging.features import build_features
from evcharging.models.segmentation import fit_segmentation


@pytest.fixture(scope="module")
def features_df(raw_df: pd.DataFrame) -> pd.DataFrame:
    return add_validation_flags(build_features(raw_df))


def test_overview_headline_numbers(features_df: pd.DataFrame) -> None:
    ov = overview(features_df)
    assert ov["n_sessions"] == 1320
    assert ov["n_stations"] == 462
    assert ov["n_locations"] == 5
    assert 0 <= ov["peak_hour"] <= 23
    assert ov["most_used_charger_type"] in {"Level 1", "Level 2", "DC Fast Charger"}
    assert ov["total_energy_kwh"] > 0
    assert ov["data_quality"]["pct_sessions_flagged"] > 90  # this dataset is that bad


def test_patterns_shapes(features_df: pd.DataFrame) -> None:
    pat = patterns(features_df)
    assert len(pat["by_hour"]) == 24
    assert len(pat["by_weekday"]) == 7
    assert len(pat["by_charger_type"]) == 3
    assert len(pat["by_vehicle_model"]) == 5
    assert set(pat["weekend_vs_weekday"]) == {"weekday", "weekend"}
    # counts are integers, not floats
    assert all(isinstance(row["sessions"], int) for row in pat["by_hour"])
    # every hour has exactly 55 sessions (the grid)
    assert {row["sessions"] for row in pat["by_hour"]} == {55}


def test_locations_sorted_by_energy(features_df: pd.DataFrame) -> None:
    locs = locations(features_df)
    assert len(locs) == 5
    energies = [row["total_energy_kwh"] for row in locs]
    assert energies == sorted(energies, reverse=True)
    assert sum(row["sessions"] for row in locs) == 1320


def test_segments_uses_bundle_or_returns_empty(features_df: pd.DataFrame) -> None:
    assert segments(features_df, None) == []

    result = fit_segmentation(features_df, k=4)
    bundle = {"pipeline": result.pipeline, "archetypes": result.archetypes}
    segs = segments(features_df, bundle)
    assert len(segs) == 4
    assert sum(s["n_sessions"] for s in segs) == 1320
    assert all(s["archetype"] for s in segs)


def test_anomalies_bucket_counts_sum_to_total(features_df: pd.DataFrame) -> None:
    assert anomalies(features_df, None) == {}

    rng = np.random.default_rng(0)
    scores = rng.random(len(features_df))
    a = anomalies(features_df, scores)
    assert a["n_high_risk"] + a["n_medium_risk"] + a["n_normal"] == len(features_df)
    assert len(a["worst_sessions"]) == 5


def test_build_analytics_is_json_serialisable(features_df: pd.DataFrame) -> None:
    payload = build_analytics(features_df)
    text = json.dumps(payload)  # raises if any numpy type leaked through
    assert "overview" in json.loads(text)
    assert set(payload) == {
        "generated_at", "overview", "patterns", "locations", "segments", "anomalies"
    }
