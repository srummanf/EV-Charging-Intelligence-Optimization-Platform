"""Fixtures for the API tests.

The client is session-scoped: ``TestClient`` runs the lifespan handler, which loads all
five model artifacts and the analytics payload once. If those files are missing the whole
API test module is skipped with a hint.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from evcharging.config import ANALYTICS_JSON, CLEAN_PARQUET, MODELS_DIR

_REQUIRED = [
    CLEAN_PARQUET,
    ANALYTICS_JSON,
    MODELS_DIR / "energy_regressor.joblib",
    MODELS_DIR / "session_anomaly.joblib",
    MODELS_DIR / "demand_forecaster.joblib",
]


@pytest.fixture(scope="session")
def client() -> TestClient:
    if any(not p.exists() for p in _REQUIRED):
        pytest.skip(
            "model artifacts / processed data missing - run "
            "`python scripts/prepare_data.py && python scripts/train_all.py`"
        )
    from api.app import create_app

    with TestClient(create_app()) as c:
        yield c
