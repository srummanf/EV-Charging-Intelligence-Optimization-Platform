"""Pydantic v2 request and response models for the API.

Request models validate and document the inputs; response models pin the output shape so
the OpenAPI schema (and the future TypeScript client) stay accurate. Analytics endpoints
return the precomputed payload sections as-is and are typed loosely as ``dict``.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from evcharging.models.regression import LOCATIONS, USER_TYPES, VEHICLE_MODELS

VehicleModel = Literal[tuple(VEHICLE_MODELS)]  # type: ignore[valid-type]
Location = Literal[tuple(LOCATIONS)]  # type: ignore[valid-type]
UserType = Literal[tuple(USER_TYPES)]  # type: ignore[valid-type]
ChargerType = Literal["Level 1", "Level 2", "DC Fast Charger"]


# --- health -----------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: Literal["ok"]
    models_loaded: list[str]
    n_sessions: int
    analytics_generated_at: str | None


# --- predictions ----------------------------------------------------------------

class PredictionRequest(BaseModel):
    """Pre-session inputs for the energy and duration regressors."""

    vehicle_model: VehicleModel = "Tesla Model 3"
    battery_capacity_kwh: float = Field(60.0, gt=0, le=250)
    soc_start_pct: float = Field(20.0, ge=0, le=100)
    soc_end_pct: float = Field(80.0, ge=0, le=100)
    distance_km: float = Field(50.0, ge=0, le=2000)
    temperature_c: float = Field(20.0, ge=-40, le=60)
    vehicle_age_years: float = Field(3.0, ge=0, le=30)
    charger_type: ChargerType = "Level 2"
    hour: int = Field(18, ge=0, le=23)
    weekday: int = Field(2, ge=0, le=6, description="0 = Monday")
    location: Location = "New York"
    user_type: UserType = "Commuter"


class PredictionResponse(BaseModel):
    prediction: float
    unit: str
    model: str
    note: str


# --- recommendation -----------------------------------------------------------

class RecommendationRequestModel(BaseModel):
    vehicle_model: VehicleModel = "Tesla Model 3"
    battery_capacity_kwh: float = Field(60.0, gt=0, le=250)
    soc_start_pct: float = Field(30.0, ge=0, le=100)
    soc_target_pct: float = Field(80.0, ge=0, le=100)
    distance_km: float = Field(0.0, ge=0, le=2000)
    earliest_hour: int = Field(0, ge=0, le=23)
    hours_available: float = Field(8.0, gt=0, le=72)
    temperature_c: float = Field(20.0, ge=-40, le=60)
    user_type: UserType = "Commuter"


class ChargerOption(BaseModel):
    charger_type: ChargerType
    power_kw: float
    energy_kwh: float
    duration_hours: float
    cost_usd: float
    fits_time_budget: bool


class RecommendationResponse(BaseModel):
    recommended_charger: ChargerType
    estimated_energy_kwh: float
    estimated_duration_hours: float
    estimated_cost_usd: float
    charging_window: str
    session_archetype: str | None
    reason: str
    model_energy_kwh: float | None
    notes: list[str]
    options: list[ChargerOption]


# --- anomalies & forecast ------------------------------------------------------

class AnomalySession(BaseModel):
    index: int
    station_id: str
    location: str
    vehicle_model: str
    energy_kwh: float | None
    battery_capacity_kwh: float | None
    soc_delta_pct: float | None
    anomaly_score: float
    risk: Literal["high", "medium", "normal"]
    reasons: str


class AnomalyListResponse(BaseModel):
    count: int
    total_flagged: int
    threshold: float
    sessions: list[AnomalySession]


class ForecastPoint(BaseModel):
    timestamp: str
    hour: int
    predicted_energy_kwh: float


class HistoryPoint(BaseModel):
    timestamp: str
    hour: int
    energy_kwh: float


class ForecastResponse(BaseModel):
    horizon_hours: int
    generated_from: str
    history: list[HistoryPoint]
    points: list[ForecastPoint]
    baseline_mean_kwh: float
    caveat: str
