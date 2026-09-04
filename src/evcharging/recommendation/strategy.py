"""Charging recommendation engine - Module G.

Given a driver's situation (vehicle, current and target state of charge, distance to
cover, when they want to charge), return a concrete plan: which charger to use, when to
start, and the expected energy, time and cost, with a one-line reason.

**Design note.** Notebooks 03-04 showed that on this dataset the ML energy and duration
models do not beat a mean baseline - the synthetic targets carry no signal. So the
estimates here are built on **charging physics**, which is defensible regardless of the
data:

- energy needed = SOC gap x battery capacity
- time = energy / the charger's nominal power
- cost = energy x price per kWh (calibrated from the dataset)

The trained models are still consulted, as a **sanity band** around the physics number,
and the demand forecaster picks the cheapest-load hour. The functions that do the
reasoning are pure - they take plain numbers and return plain numbers - so they are
straightforward to unit-test; a thin wrapper loads the artifacts and calls them.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

# Nominal delivered power by charger type, in kW. Round real-world figures for the
# common case; the dataset's own ``charging_rate_kw`` is not physically consistent so it
# is not used here.
NOMINAL_POWER_KW: dict[str, float] = {
    "Level 1": 1.4,
    "Level 2": 7.0,
    "DC Fast Charger": 50.0,
}
CHARGER_TYPES_BY_SPEED = ["Level 1", "Level 2", "DC Fast Charger"]

# Price per kWh, calibrated from the dataset (mean cost / mean energy ~= 0.53). Used as a
# default; a caller can override.
DEFAULT_PRICE_PER_KWH = 0.53

# Charging efficiency: a little more energy is drawn than reaches the battery.
CHARGING_EFFICIENCY = 0.9


@dataclass
class RecommendationRequest:
    """A driver's charging situation."""

    vehicle_model: str
    battery_capacity_kwh: float
    soc_start_pct: float
    soc_target_pct: float
    distance_km: float = 0.0
    earliest_hour: int = 0          # first hour the driver could start (0-23)
    hours_available: float = 8.0    # how long the vehicle can stay plugged in
    temperature_c: float = 20.0
    user_type: str = "Commuter"

    def __post_init__(self) -> None:
        if not 0 <= self.soc_start_pct <= 100:
            raise ValueError("soc_start_pct must be in 0..100")
        if not 0 <= self.soc_target_pct <= 100:
            raise ValueError("soc_target_pct must be in 0..100")
        if self.soc_target_pct <= self.soc_start_pct:
            raise ValueError("soc_target_pct must be greater than soc_start_pct")
        if self.battery_capacity_kwh <= 0:
            raise ValueError("battery_capacity_kwh must be positive")
        if not 0 <= self.earliest_hour <= 23:
            raise ValueError("earliest_hour must be in 0..23")


@dataclass
class ChargingRecommendation:
    """The plan returned to the driver."""

    recommended_charger: str
    estimated_energy_kwh: float
    estimated_duration_hours: float
    estimated_cost_usd: float
    start_hour: int
    end_hour: int
    session_archetype: str | None
    reason: str
    model_energy_kwh: float | None = None  # ML sanity-band value, if a model was supplied
    notes: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "recommended_charger": self.recommended_charger,
            "estimated_energy_kwh": round(self.estimated_energy_kwh, 2),
            "estimated_duration_hours": round(self.estimated_duration_hours, 2),
            "estimated_cost_usd": round(self.estimated_cost_usd, 2),
            "charging_window": f"{self.start_hour:02d}:00-{self.end_hour:02d}:00",
            "session_archetype": self.session_archetype,
            "reason": self.reason,
            "model_energy_kwh": (
                round(self.model_energy_kwh, 2) if self.model_energy_kwh is not None else None
            ),
            "notes": self.notes,
        }


# --- pure estimators --------------------------------------------------------------

def estimate_energy_kwh(
    soc_start_pct: float,
    soc_target_pct: float,
    battery_capacity_kwh: float,
    efficiency: float = CHARGING_EFFICIENCY,
) -> float:
    """Energy drawn from the charger to move the battery from start to target SOC.

    ``(SOC_gap / 100) x capacity`` is the energy *into the battery*; dividing by the
    charging efficiency gives the energy *out of the charger*, which is what is metered
    and billed.
    """
    into_battery = (soc_target_pct - soc_start_pct) / 100.0 * battery_capacity_kwh
    return into_battery / efficiency


def nominal_power_kw(charger_type: str) -> float:
    """Nominal delivered power for a charger type, in kW."""
    try:
        return NOMINAL_POWER_KW[charger_type]
    except KeyError:
        raise ValueError(f"unknown charger_type: {charger_type!r}") from None


def estimate_duration_hours(energy_kwh: float, charger_type: str) -> float:
    """Charging time = energy / nominal power. Ignores the taper near full charge."""
    return energy_kwh / nominal_power_kw(charger_type)


def estimate_cost_usd(energy_kwh: float, price_per_kwh: float = DEFAULT_PRICE_PER_KWH) -> float:
    """Session cost = metered energy x price per kWh."""
    return energy_kwh * price_per_kwh


def recommend_charger_type(energy_kwh: float, hours_available: float) -> tuple[str, str]:
    """Pick the slowest (cheapest, gentlest) charger that still finishes in time.

    Battery health and cost both favour slower charging, so we step up from Level 1 only
    when the time budget forces it. If even a DC fast charger cannot finish in time, we
    still recommend it (the best available) and the caller adds a note.

    Returns ``(charger_type, rationale)``.
    """
    for charger in CHARGER_TYPES_BY_SPEED:
        if estimate_duration_hours(energy_kwh, charger) <= hours_available:
            if charger == "Level 1":
                return charger, "a slow Level 1 charge comfortably fits the time available"
            if charger == "Level 2":
                return charger, "Level 2 is the gentlest charger that fits the time available"
            return charger, "DC fast charging is needed to finish within the time available"
    return "DC Fast Charger", "even DC fast charging will not fully finish in the time available"


def best_charging_window(
    demand_by_hour: pd.Series,
    duration_hours: float,
    earliest_hour: int = 0,
    horizon_hours: int = 24,
) -> tuple[int, int]:
    """Choose the start hour whose forward window has the lowest total predicted demand.

    ``demand_by_hour`` is indexed 0..23 with a predicted network load for each hour. We
    slide a window of ``ceil(duration)`` hours over ``earliest_hour .. earliest_hour +
    horizon`` and pick the start with the smallest summed demand, so the driver charges
    when the network is quietest.

    Returns ``(start_hour, end_hour)`` as 0..23 clock hours.
    """
    span = max(1, int(round(duration_hours + 0.499)))
    best_start, best_load = earliest_hour % 24, float("inf")
    for offset in range(horizon_hours):
        start = (earliest_hour + offset) % 24
        window = [(start + h) % 24 for h in range(span)]
        load = float(sum(demand_by_hour.get(h, demand_by_hour.mean()) for h in window))
        if load < best_load:
            best_load, best_start = load, start
    return best_start, (best_start + span) % 24


# --- wiring -----------------------------------------------------------------------

def _archetype_for(request: RecommendationRequest, energy_kwh: float,
                   duration_hours: float, segmenter_bundle) -> str | None:
    """Assign the implied session to a behavioural archetype, if a segmenter is given."""
    if segmenter_bundle is None:
        return None
    from evcharging.models.segmentation import CLUSTER_FEATURES

    row = {
        "energy_kwh": energy_kwh,
        "duration_hours": duration_hours,
        "distance_km": request.distance_km,
        "soc_delta_pct": request.soc_target_pct - request.soc_start_pct,
        "charging_rate_kw": energy_kwh / duration_hours if duration_hours else 0.0,
        "cost_usd": estimate_cost_usd(energy_kwh),
    }
    X = pd.DataFrame([[row[c] for c in CLUSTER_FEATURES]], columns=CLUSTER_FEATURES)
    cluster = int(segmenter_bundle["pipeline"].predict(X)[0])
    return segmenter_bundle["archetypes"].get(cluster)


def _energy_model_row(request: RecommendationRequest) -> pd.DataFrame:
    """A single-row predictor frame in the exact column order the energy model expects."""
    from evcharging.config import NOMINAL_BATTERY_KWH
    from evcharging.models.regression import NUMERIC_PREDICTORS

    vehicles = sorted(NOMINAL_BATTERY_KWH)  # the 5 known vehicle models
    locations = ["Chicago", "Houston", "Los Angeles", "New York", "San Francisco"]
    user_types = ["Casual Driver", "Commuter", "Long-Distance Traveler"]

    values = {
        "battery_capacity_kwh": request.battery_capacity_kwh,
        "soc_start_pct": request.soc_start_pct,
        "soc_end_pct": request.soc_target_pct,
        "soc_delta_pct": request.soc_target_pct - request.soc_start_pct,
        "distance_km": request.distance_km,
        "temperature_c": request.temperature_c,
        "vehicle_age_years": 3.0,
        "charger_type_code": 1,
        "hour": request.earliest_hour,
        "weekday": 2,
        "is_weekend": 0,
    }
    for v in vehicles:
        values[f"vehicle_model_{v}"] = int(v == request.vehicle_model)
    for loc in locations:
        values[f"location_{loc}"] = 0
    for ut in user_types:
        values[f"user_type_{ut}"] = int(ut == request.user_type)

    one_hot = sorted(c for c in values if c.startswith(
        ("vehicle_model_", "location_", "user_type_")))
    cols = NUMERIC_PREDICTORS + one_hot
    return pd.DataFrame([[float(values[c]) for c in cols]], columns=cols)


def _model_energy(request: RecommendationRequest, energy_model) -> float | None:
    """Run the trained energy regressor for a sanity-band value, or ``None`` on failure."""
    if energy_model is None:
        return None
    try:
        return float(energy_model.predict(_energy_model_row(request))[0])
    except Exception:
        return None


def recommend(
    request: RecommendationRequest,
    demand_by_hour: pd.Series | None = None,
    segmenter_bundle: dict | None = None,
    energy_model=None,
    price_per_kwh: float = DEFAULT_PRICE_PER_KWH,
) -> ChargingRecommendation:
    """Produce a :class:`ChargingRecommendation` for ``request``.

    Args:
        request: The driver's situation.
        demand_by_hour: Predicted network demand indexed by hour 0..23. If omitted, a
            flat series is used and the window defaults to ``earliest_hour``.
        segmenter_bundle: The loaded ``session_segmenter.joblib`` dict, for the archetype.
        energy_model: The loaded energy regressor, for a sanity-band comparison.
        price_per_kwh: Override the calibrated price.
    """
    notes: list[str] = []

    energy_kwh = estimate_energy_kwh(
        request.soc_start_pct, request.soc_target_pct, request.battery_capacity_kwh
    )
    if energy_kwh > request.battery_capacity_kwh:
        energy_kwh = request.battery_capacity_kwh
        notes.append("energy capped at battery capacity")

    charger, charger_reason = recommend_charger_type(energy_kwh, request.hours_available)
    duration_hours = estimate_duration_hours(energy_kwh, charger)
    if duration_hours > request.hours_available:
        notes.append(
            f"expected charge time ({duration_hours:.1f} h) exceeds the "
            f"{request.hours_available:.1f} h available; plan for a partial charge"
        )
    cost_usd = estimate_cost_usd(energy_kwh, price_per_kwh)

    if demand_by_hour is None:
        demand_by_hour = pd.Series({h: 1.0 for h in range(24)})
        notes.append("no demand forecast supplied; charging window not load-optimised")
    start_hour, end_hour = best_charging_window(
        demand_by_hour, duration_hours, request.earliest_hour
    )

    archetype = _archetype_for(request, energy_kwh, duration_hours, segmenter_bundle)
    model_energy = _model_energy(request, energy_model)
    if model_energy is not None and abs(model_energy - energy_kwh) > 0.5 * energy_kwh:
        notes.append(
            f"the trained energy model expects ~{model_energy:.0f} kWh for a session like "
            f"this (population average); the physics estimate is used above"
        )

    charger_reason = charger_reason[0].upper() + charger_reason[1:]
    reason = (
        f"You need about {energy_kwh:.0f} kWh to go from {request.soc_start_pct:.0f}% to "
        f"{request.soc_target_pct:.0f}%. {charger_reason}. "
        f"Start around {start_hour:02d}:00, when predicted network demand is lowest."
    )

    return ChargingRecommendation(
        recommended_charger=charger,
        estimated_energy_kwh=energy_kwh,
        estimated_duration_hours=duration_hours,
        estimated_cost_usd=cost_usd,
        start_hour=start_hour,
        end_hour=end_hour,
        session_archetype=archetype,
        reason=reason,
        model_energy_kwh=model_energy,
        notes=notes,
    )


def load_context(models_dir=None) -> dict:
    """Load the artifacts ``recommend`` can use: the segmenter, the energy model, and a
    demand-by-hour series derived from the demand forecaster's training data.

    Returns a dict with keys ``segmenter_bundle``, ``energy_model``, ``demand_by_hour``.
    Missing artifacts come back as ``None`` so ``recommend`` still works.
    """
    from evcharging.config import CLEAN_PARQUET, MODELS_DIR
    from evcharging.models.common import load_artifact

    models_dir = models_dir or MODELS_DIR
    ctx: dict = {"segmenter_bundle": None, "energy_model": None, "demand_by_hour": None}

    try:
        ctx["segmenter_bundle"] = load_artifact("session_segmenter.joblib", models_dir)
    except FileNotFoundError:
        pass
    try:
        ctx["energy_model"] = load_artifact("energy_regressor.joblib", models_dir)
    except FileNotFoundError:
        pass
    try:
        bundle = load_artifact("demand_forecaster.joblib", models_dir)
        from evcharging.models.demand import build_hourly_demand

        hourly = build_hourly_demand(pd.read_parquet(CLEAN_PARQUET))
        preds = bundle["model"].predict(hourly[bundle["features"]])
        ctx["demand_by_hour"] = (
            pd.Series(preds, index=hourly["hour"].to_numpy()).groupby(level=0).mean()
        )
    except FileNotFoundError:
        pass

    return ctx
