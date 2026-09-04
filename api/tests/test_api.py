"""End-to-end tests for every API endpoint, via ``TestClient``."""

from __future__ import annotations

import pytest


def test_root_and_health(client) -> None:
    assert client.get("/").json()["docs"] == "/docs"

    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert len(body["models_loaded"]) == 5
    assert body["n_sessions"] == 1320
    assert body["analytics_generated_at"]


@pytest.mark.parametrize(
    "path",
    ["/analytics/overview", "/analytics/patterns", "/analytics/locations", "/analytics/segments"],
)
def test_analytics_endpoints(client, path) -> None:
    resp = client.get(path)
    assert resp.status_code == 200
    assert resp.json()  # non-empty


def test_analytics_overview_shape(client) -> None:
    ov = client.get("/analytics/overview").json()
    assert ov["n_sessions"] == 1320
    assert ov["n_stations"] == 462
    assert "data_quality" in ov


def test_analytics_segments_have_archetypes(client) -> None:
    segs = client.get("/analytics/segments").json()
    assert len(segs) == 4
    assert all(s["archetype"] for s in segs)


def test_anomalies_default_and_filtered(client) -> None:
    body = client.get("/anomalies").json()
    assert body["count"] == 50
    assert body["total_flagged"] > 0
    scores = [s["anomaly_score"] for s in body["sessions"]]
    assert scores == sorted(scores, reverse=True)

    high = client.get("/anomalies", params={"risk": "high", "limit": 5}).json()
    assert all(s["risk"] == "high" for s in high["sessions"])

    strict = client.get("/anomalies", params={"min_score": 0.5}).json()
    assert all(s["anomaly_score"] >= 0.5 for s in strict["sessions"])


def test_anomalies_rejects_bad_params(client) -> None:
    assert client.get("/anomalies", params={"min_score": 2}).status_code == 422
    assert client.get("/anomalies", params={"limit": 0}).status_code == 422


def test_forecast(client) -> None:
    body = client.get("/forecast", params={"hours": 12}).json()
    assert body["horizon_hours"] == 12
    assert len(body["points"]) == 12
    assert all(p["predicted_energy_kwh"] > 0 for p in body["points"])
    assert len(body["history"]) == 72
    assert all("energy_kwh" in p for p in body["history"])
    assert "seasonality" in body["caveat"]


def test_predict_energy_and_duration(client) -> None:
    payload = {
        "vehicle_model": "Tesla Model 3",
        "battery_capacity_kwh": 60,
        "soc_start_pct": 20,
        "soc_end_pct": 80,
        "charger_type": "DC Fast Charger",
    }
    e = client.post("/predict/energy", json=payload).json()
    assert e["unit"] == "kWh" and e["prediction"] > 0 and "baseline" in e["note"]

    d = client.post("/predict/duration", json=payload).json()
    assert d["unit"] == "hours" and d["prediction"] > 0


def test_predict_validates_input(client) -> None:
    bad = client.post("/predict/energy", json={"soc_start_pct": 150})
    assert bad.status_code == 422
    unknown_vehicle = client.post("/predict/energy", json={"vehicle_model": "Rivian R1T"})
    assert unknown_vehicle.status_code == 422


def test_recommend(client) -> None:
    payload = {
        "vehicle_model": "Hyundai Kona",
        "battery_capacity_kwh": 64,
        "soc_start_pct": 15,
        "soc_target_pct": 80,
        "distance_km": 300,
        "earliest_hour": 13,
        "hours_available": 1,
    }
    body = client.post("/recommend", json=payload).json()
    assert body["recommended_charger"] == "DC Fast Charger"
    assert body["estimated_energy_kwh"] > 0
    assert body["charging_window"].count(":") == 2
    assert len(body["options"]) == 3
    assert {o["charger_type"] for o in body["options"]} == {
        "Level 1", "Level 2", "DC Fast Charger"
    }


def test_recommend_rejects_target_below_start(client) -> None:
    payload = {"soc_start_pct": 80, "soc_target_pct": 50}
    assert client.post("/recommend", json=payload).status_code == 422


def test_openapi_lists_every_route(client) -> None:
    paths = client.get("/openapi.json").json()["paths"]
    for expected in [
        "/health", "/analytics/overview", "/analytics/patterns", "/analytics/locations",
        "/analytics/segments", "/anomalies", "/forecast", "/predict/energy",
        "/predict/duration", "/recommend",
    ]:
        assert expected in paths
