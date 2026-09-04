"""Tests for the recommendation engine (Module G).

The estimator functions are pure, so they are tested directly with numbers. The
``recommend`` wrapper is tested with injected inputs (no artifacts on disk needed).
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from evcharging.recommendation.strategy import (
    ChargingRecommendation,
    RecommendationRequest,
    best_charging_window,
    estimate_cost_usd,
    estimate_duration_hours,
    estimate_energy_kwh,
    nominal_power_kw,
    recommend,
    recommend_charger_type,
)

# --- pure estimators --------------------------------------------------------------


def test_estimate_energy_uses_soc_gap_capacity_and_efficiency() -> None:
    # 50% of a 60 kWh pack = 30 kWh into the battery; / 0.9 efficiency = 33.33 out
    assert estimate_energy_kwh(20, 70, 60, efficiency=0.9) == pytest.approx(33.333, rel=1e-3)


def test_estimate_energy_scales_with_capacity() -> None:
    small = estimate_energy_kwh(10, 90, 40)
    big = estimate_energy_kwh(10, 90, 80)
    assert big == pytest.approx(2 * small)


def test_nominal_power_order_and_unknown() -> None:
    assert (
        nominal_power_kw("Level 1")
        < nominal_power_kw("Level 2")
        < nominal_power_kw("DC Fast Charger")
    )
    with pytest.raises(ValueError):
        nominal_power_kw("Supercharger V4")


def test_duration_is_energy_over_power() -> None:
    assert estimate_duration_hours(50, "DC Fast Charger") == pytest.approx(1.0)
    assert estimate_duration_hours(14, "Level 2") == pytest.approx(2.0)


def test_cost_is_energy_times_price() -> None:
    assert estimate_cost_usd(40, price_per_kwh=0.5) == pytest.approx(20.0)


def test_recommend_charger_type_picks_slowest_that_fits() -> None:
    # 10 kWh in 24 h -> Level 1 fine (7.1 h)
    assert recommend_charger_type(10, hours_available=24)[0] == "Level 1"
    # 30 kWh in 5 h -> Level 1 too slow (21 h), Level 2 fits (4.3 h)
    assert recommend_charger_type(30, hours_available=5)[0] == "Level 2"
    # 40 kWh in 1 h -> only DC fits
    assert recommend_charger_type(40, hours_available=1)[0] == "DC Fast Charger"
    # 60 kWh in 0.5 h -> nothing fully fits, still DC
    charger, why = recommend_charger_type(60, hours_available=0.5)
    assert charger == "DC Fast Charger" and "not" in why


def test_best_charging_window_finds_the_quiet_hours() -> None:
    demand = pd.Series({h: 100.0 for h in range(24)})
    demand.loc[3] = demand.loc[4] = 1.0  # clear trough at 03:00-05:00
    start, end = best_charging_window(demand, duration_hours=2.0, earliest_hour=0)
    assert start == 3 and end == 5


def test_best_charging_window_respects_earliest_hour_within_horizon() -> None:
    demand = pd.Series({h: 10.0 for h in range(24)})
    start, _ = best_charging_window(demand, 1.0, earliest_hour=22, horizon_hours=3)
    assert start in {22, 23, 0}


# --- request validation ---------------------------------------------------------


@pytest.mark.parametrize(
    "kwargs",
    [
        dict(soc_start_pct=80, soc_target_pct=50),  # target below start
        dict(soc_start_pct=-5, soc_target_pct=50),  # start out of range
        dict(soc_start_pct=20, soc_target_pct=120),  # target out of range
        dict(battery_capacity_kwh=0),  # non-positive capacity
        dict(earliest_hour=25),  # bad hour
    ],
)
def test_request_rejects_bad_input(kwargs) -> None:
    base = dict(
        vehicle_model="Nissan Leaf",
        battery_capacity_kwh=40,
        soc_start_pct=20,
        soc_target_pct=80,
    )
    base.update(kwargs)
    with pytest.raises(ValueError):
        RecommendationRequest(**base)


# --- end to end ---------------------------------------------------------------


def test_recommend_end_to_end_minimal() -> None:
    req = RecommendationRequest(
        vehicle_model="Tesla Model 3",
        battery_capacity_kwh=60,
        soc_start_pct=30,
        soc_target_pct=80,
        distance_km=100,
        earliest_hour=18,
        hours_available=3,
    )
    rec = recommend(req)
    assert isinstance(rec, ChargingRecommendation)
    assert rec.recommended_charger in {"Level 1", "Level 2", "DC Fast Charger"}
    assert rec.estimated_energy_kwh > 0
    assert rec.estimated_cost_usd == pytest.approx(rec.estimated_energy_kwh * 0.53)
    assert 0 <= rec.start_hour <= 23
    # no demand forecast supplied -> a note says so
    assert any("demand forecast" in n for n in rec.notes)


def test_recommend_caps_energy_at_capacity() -> None:
    req = RecommendationRequest(
        vehicle_model="BMW i3",
        battery_capacity_kwh=20,
        soc_start_pct=0,
        soc_target_pct=100,
    )
    rec = recommend(req)
    assert rec.estimated_energy_kwh <= 20
    assert any("capped" in n for n in rec.notes)


def test_recommend_uses_supplied_demand_curve() -> None:
    demand = pd.Series({h: 100.0 for h in range(24)})
    demand.loc[2] = demand.loc[3] = demand.loc[4] = 1.0
    req = RecommendationRequest(
        vehicle_model="Chevy Bolt",
        battery_capacity_kwh=65,
        soc_start_pct=40,
        soc_target_pct=60,
        earliest_hour=0,
    )
    rec = recommend(req, demand_by_hour=demand)
    assert rec.start_hour in {2, 3, 4}


def test_recommend_flags_model_disagreement() -> None:
    class FakeModel:
        def predict(self, X):
            return np.array([500.0])  # absurd population average

    req = RecommendationRequest(
        vehicle_model="Hyundai Kona",
        battery_capacity_kwh=64,
        soc_start_pct=50,
        soc_target_pct=60,
    )
    rec = recommend(req, energy_model=FakeModel())
    assert rec.model_energy_kwh == 500.0
    assert any("trained energy model" in n for n in rec.notes)
