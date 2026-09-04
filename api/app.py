"""FastAPI application factory.

``app = create_app()`` is the ASGI entry point (``uvicorn api.app:app``). Startup loads
every artifact once via :meth:`AppState.load`; if something is missing the app still
starts but every data route returns 503 with a message pointing at the training scripts,
so ``/health`` and ``/docs`` remain useful for debugging a fresh checkout.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.routes import router
from api.state import AppState, ArtifactsMissing

logger = logging.getLogger("evcharging.api")

DEFAULT_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        app.state.app_state = AppState.load()
        logger.info("loaded model artifacts and analytics payload")
    except ArtifactsMissing as exc:
        app.state.app_state = None
        app.state.load_error = str(exc)
        logger.warning("starting without models: %s", exc)
    yield
    app.state.app_state = None


def create_app() -> FastAPI:
    app = FastAPI(
        title="EV Charging Intelligence & Optimization Platform API",
        version="0.1.0",
        summary="Analytics, predictions, anomaly scores, demand forecast and charging "
        "recommendations for the EV charging platform.",
        lifespan=lifespan,
    )

    origins = os.getenv("EVCHARGING_CORS_ORIGINS", DEFAULT_ORIGINS).split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in origins if o.strip()],
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    @app.exception_handler(ArtifactsMissing)
    async def _artifacts_missing(request: Request, exc: ArtifactsMissing):
        return JSONResponse(status_code=503, content={"detail": str(exc)})

    @app.exception_handler(ValueError)
    async def _value_error(request: Request, exc: ValueError):
        return JSONResponse(status_code=422, content={"detail": str(exc)})

    @app.get("/", tags=["meta"])
    async def root():
        return {
            "name": "EV Charging Intelligence & Optimization Platform API",
            "docs": "/docs",
            "health": "/health",
        }

    app.include_router(router)
    return app


app = create_app()
