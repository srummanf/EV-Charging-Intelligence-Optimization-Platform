"""All API routes on one router.

Handlers are thin: validate via the pydantic models, call into ``evcharging`` (the same
functions the notebooks use), shape the response. The loaded :class:`~api.state.AppState`
is injected with the ``get_state`` dependency.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from api.schemas import (
    AnomalyListResponse,
    ForecastResponse,
    HealthResponse,
    PredictionRequest,
    PredictionResponse,
    RecommendationRequestModel,
    RecommendationResponse,
)
from api.state import AppState
from evcharging.models.demand import forecast_horizon
from evcharging.models.regression import feature_row
from evcharging.recommendation import (
    RecommendationRequest,
    compare_chargers,
    recommend,
)

router = APIRouter()


def get_state(request: Request) -> AppState:
    state = getattr(request.app.state, "app_state", None)
    if state is None:  # pragma: no cover - set in the lifespan handler
        raise HTTPException(status_code=503, detail="models are not loaded")
    return state


# --- health -----------------------------------------------------------------------

@router.get("/health", response_model=HealthResponse, tags=["meta"])
def health(state: AppState = Depends(get_state)) -> HealthResponse:
    return HealthResponse(
        status="ok",
        models_loaded=state.models_loaded,
        n_sessions=len(state.sessions),
        analytics_generated_at=state.analytics.get("generated_at"),
    )


# --- analytics (precomputed passthrough) -------------------------------------------

@router.get("/analytics/overview", tags=["analytics"])
def analytics_overview(state: AppState = Depends(get_state)) -> dict:
    return state.analytics["overview"]


@router.get("/analytics/patterns", tags=["analytics"])
def analytics_patterns(state: AppState = Depends(get_state)) -> dict:
    return state.analytics["patterns"]


@router.get("/analytics/locations", tags=["analytics"])
def analytics_locations(state: AppState = Depends(get_state)) -> list[dict]:
    return state.analytics["locations"]


@router.get("/analytics/segments", tags=["analytics"])
def analytics_segments(state: AppState = Depends(get_state)) -> list[dict]:
    return state.analytics["segments"]


# --- anomalies -------------------------------------------------------------------

@router.get("/anomalies", response_model=AnomalyListResponse, tags=["operations"])
def anomalies(
    state: AppState = Depends(get_state),
    limit: int = Query(50, ge=1, le=500),
    min_score: float = Query(0.0, ge=0.0, le=1.0),
    risk: Literal["any", "high", "medium", "normal"] = "any",
) -> AnomalyListResponse:
    table = state.anomaly_table
    mask = table["anomaly_score"] >= min_score
    if risk != "any":
        mask &= table["risk"] == risk
    subset = table[mask].head(limit)

    return AnomalyListResponse(
        count=len(subset),
        total_flagged=int((table["anomaly_score"] >= state.anomaly_bundle["threshold"]).sum()),
        threshold=round(float(state.anomaly_bundle["threshold"]), 4),
        sessions=[
            {k: (None if _isna(v) else v) for k, v in row.items() if k != "breaks_hard_rule"}
            for row in subset.to_dict("records")
        ],
    )


def _isna(v) -> bool:
    return isinstance(v, float) and v != v


# --- forecast -------------------------------------------------------------------

@router.get("/forecast", response_model=ForecastResponse, tags=["operations"])
def forecast(
    state: AppState = Depends(get_state),
    hours: int = Query(24, ge=1, le=168),
) -> ForecastResponse:
    hourly = state.hourly_demand
    points = forecast_horizon(state.demand_bundle["model"], hourly, horizon=hours)
    demand_metrics = state.metrics.get("demand", {})
    baseline = demand_metrics.get("baseline_mean", {}).get("mae")

    tail = hourly.tail(min(72, len(hourly)))
    history = [
        {"timestamp": ts.isoformat(), "hour": int(ts.hour), "energy_kwh": round(float(v), 2)}
        for ts, v in tail["energy_kwh"].items()
    ]
    return ForecastResponse(
        horizon_hours=hours,
        generated_from=hourly.index[-1].isoformat(),
        history=history,
        points=points,
        baseline_mean_kwh=round(float(state.hourly_demand["energy_kwh"].mean()), 2),
        caveat=(
            "The hourly energy series has no trend or seasonality (autocorrelation ~ 0), "
            "so this forecast tracks the historical mean. Walk-forward MAE is about "
            f"{demand_metrics.get('model', {}).get('mae', 'n/a')} kWh vs "
            f"{baseline} for a flat mean. Treat it as a planning average."
        ),
    )


# --- predictions ---------------------------------------------------------------

def _predict(model, req: PredictionRequest, target: str, unit: str) -> PredictionResponse:
    charger_code = ["Level 1", "Level 2", "DC Fast Charger"].index(req.charger_type)
    row = feature_row(
        vehicle_model=req.vehicle_model,
        location=req.location,
        user_type=req.user_type,
        battery_capacity_kwh=req.battery_capacity_kwh,
        soc_start_pct=req.soc_start_pct,
        soc_end_pct=req.soc_end_pct,
        soc_delta_pct=req.soc_end_pct - req.soc_start_pct,
        distance_km=req.distance_km,
        temperature_c=req.temperature_c,
        vehicle_age_years=req.vehicle_age_years,
        charger_type_code=charger_code,
        hour=req.hour,
        weekday=req.weekday,
        is_weekend=int(req.weekday >= 5),
    )
    value = float(model.predict(row)[0])
    return PredictionResponse(
        prediction=round(value, 3),
        unit=unit,
        model=type(model).__name__,
        note=(
            f"On this synthetic dataset no model beats a mean baseline for {target}, so "
            "the served model is the population mean. Expect the same value regardless of "
            "input; see notebooks 03-04."
        ),
    )


@router.post("/predict/energy", response_model=PredictionResponse, tags=["predictions"])
def predict_energy(
    req: PredictionRequest, state: AppState = Depends(get_state)
) -> PredictionResponse:
    return _predict(state.energy_model, req, "energy", "kWh")


@router.post("/predict/duration", response_model=PredictionResponse, tags=["predictions"])
def predict_duration(
    req: PredictionRequest, state: AppState = Depends(get_state)
) -> PredictionResponse:
    return _predict(state.duration_model, req, "duration", "hours")


# --- recommendation -----------------------------------------------------------

@router.post("/recommend", response_model=RecommendationResponse, tags=["recommendation"])
def recommend_route(
    req: RecommendationRequestModel, state: AppState = Depends(get_state)
) -> RecommendationResponse:
    try:
        dataclass_req = RecommendationRequest(**req.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    rec = recommend(
        dataclass_req,
        demand_by_hour=state.demand_by_hour,
        segmenter_bundle=state.segmenter_bundle,
        energy_model=state.energy_model,
    )
    return RecommendationResponse(
        **rec.as_dict(),
        options=compare_chargers(dataclass_req),
    )
