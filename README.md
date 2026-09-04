# EV Charging Intelligence & Optimization Platform

A data pipeline, five ML models, a physics-based recommendation engine, a FastAPI
backend, and a Next.js dashboard — built on a public synthetic dataset of 1,320 EV
charging sessions.

![CI](https://github.com/srummanf/EV-Charging-Intelligence-Optimization-Platform/actions/workflows/ci.yml/badge.svg)
![Python](https://img.shields.io/badge/python-3.10%2B-blue)
![Node](https://img.shields.io/badge/node-20%2B-green)
![Tests](https://img.shields.io/badge/tests-69%20passing-brightgreen)
![Dataset](https://img.shields.io/badge/dataset-synthetic-orange)

## What's actually here

1. **Data validation** (`src/evcharging/data`) — 9 physics-based rules flag implausible
   rows. On this dataset, 98% of rows break at least one rule.
2. **Five ML models** (`src/evcharging/models`) — energy regressor, duration regressor,
   K-Means segmentation, Isolation Forest anomaly detection, GBM demand forecasting.
   Each is cross-validated against a mean/naive baseline.
3. **A recommendation engine** (`src/evcharging/recommendation`) — charger type, time
   window, energy/duration/cost estimate for a driver, computed from charging physics
   (not from the regressors above).
4. **A FastAPI service** (`api/`) — 10 endpoints serving the models, analytics, and
   recommendations.
5. **A Next.js dashboard** (`web/`) — overview, analytics, segments, anomalies, forecast,
   and a driver recommendation form.
6. **Packaging** — Docker Compose, GitHub Actions CI (retrains from scratch on every
   push), 69 tests, optional MLflow tracking.

## The honest result

The dataset is synthetic and its columns were generated independently, so most of the
ML doesn't work — and this project reports that instead of hiding it:

| Model | Result |
| --- | --- |
| Energy regressor | Ties the mean baseline (MAE 19.08 kWh). No learned model beats it. |
| Duration regressor | Same (MAE 0.87 h). |
| Segmentation | Silhouette ≈ 0.12 — one continuous cloud, not distinct clusters. |
| Anomaly detection | Precision 0.47 / recall 0.28 vs. hard rules — the one model that beats chance. |
| Demand forecasting | Loses to a flat mean (19.58 vs. 18.71 MAE). No real trend to learn. |

**Four of five models produce a null result.** The recommendation engine — the one
feature a driver actually uses — is deliberately not built on the regressors; it's
plain charging-physics arithmetic (`SOC gap × battery capacity ÷ charger power`), with
the trained models kept only as a sanity check. What this project demonstrates is the
pipeline and the discipline to report a negative result honestly, not a solved
prediction problem. Swap in real charging data and the same pipeline would tell you
whether real signal exists.

## Run it

```bash
# Docker (nothing else needed)
docker compose up --build      # API → :8000/docs   dashboard → :3000

# Or locally
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev,api,viz]"

python scripts/prepare_data.py      # → data/processed/sessions_clean.parquet
python scripts/train_all.py         # trains all 5 models + analytics.json → models/

uvicorn api.app:app --reload        # http://localhost:8000/docs
cd web && npm install && npm run dev # http://localhost:3000

pytest                               # 69 tests
```

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | liveness + which artifacts loaded |
| `GET` | `/analytics/{overview,patterns,locations,segments}` | precomputed dashboard payload |
| `GET` | `/anomalies` | ranked anomalous sessions (`?limit=`, `?min_score=`, `?risk=`) |
| `GET` | `/forecast` | hourly demand forecast + recent history (`?hours=`) |
| `POST` | `/predict/energy`, `/predict/duration` | regressor output (see caveat above) |
| `POST` | `/recommend` | full charging plan for a driver |

## Repository map

```
ev/
├── data/raw/ev_charging_patterns.csv     source data (Kaggle, synthetic)
├── src/evcharging/                       data · features · models · recommendation · analytics
├── scripts/                              prepare_data.py · train_all.py · build_analytics.py
├── api/                                  FastAPI service
├── web/                                  Next.js dashboard
├── notebooks/                            01_eda … 09_operator_analytics
├── tests/                                69 pytest tests
└── docker-compose.yml · Makefile · pyproject.toml
```

## Data

[Electric Vehicle Charging Patterns](https://www.kaggle.com/datasets/valakhorasani/electric-vehicle-charging-patterns)
by Vala Khorasani (Kaggle) — synthetic, included for demonstration only, not a reliable
source for research or publication.
