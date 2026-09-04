# API — EV Charging Platform (Phase 4)

FastAPI service that exposes the trained models, the recommendation engine and the
precomputed analytics payload.

## Run locally

```bash
pip install -e ".[api]"          # or: pip install -r requirements.txt
python scripts/prepare_data.py   # once, if data/processed/ is empty
python scripts/train_all.py      # writes models/ + data/processed/analytics.json

uvicorn api.app:app --reload
```

Open <http://localhost:8000/docs> for the interactive OpenAPI UI.

If the artifacts are missing the app still starts; `/health` and `/docs` work and every
data route returns **503** with a message telling you which script to run.

## Docker

```bash
docker build -f api/Dockerfile -t evcharging-api .   # from the repo root
docker run -p 8000:8000 evcharging-api
```

The image regenerates the dataset, trains the models and builds the analytics payload at
build time, so it needs no mounted volumes.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness + which artifacts loaded |
| GET | `/analytics/overview` | KPI row (sessions, energy, cost, peak hour, data quality) |
| GET | `/analytics/patterns` | Breakdowns by hour, weekday, charger type, vehicle |
| GET | `/analytics/locations` | Per-city table |
| GET | `/analytics/segments` | K-Means cluster profiles + archetype names |
| GET | `/anomalies` | Ranked anomalous sessions — `?limit=`, `?min_score=`, `?risk=high\|medium\|normal` |
| GET | `/forecast` | Recursive hourly demand forecast — `?hours=` (1–168) |
| POST | `/predict/energy` | Energy regressor (`kWh`) for a pre-session request |
| POST | `/predict/duration` | Duration regressor (`hours`) |
| POST | `/recommend` | Full charging plan: charger, window, energy/time/cost, reason, options |

Analytics routes serve `data/processed/analytics.json` unchanged (no pandas at request
time). The `/predict/*` responses carry a `note` stating that no model beats a mean
baseline on this synthetic data — see notebooks 03–04.

## Configuration

| Env var | Default | Meaning |
| --- | --- | --- |
| `EVCHARGING_CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated allowed origins for the web app |

## Layout

```
api/
├── app.py       create_app(): CORS, exception handlers, lifespan (loads AppState)
├── state.py     AppState.load() — artifacts + analytics + derived anomaly table
├── routes.py    all endpoints on one APIRouter
├── schemas.py   pydantic v2 request/response models
├── tests/       TestClient coverage for every endpoint
└── Dockerfile
```

## Tests

```bash
pytest api/tests
```
