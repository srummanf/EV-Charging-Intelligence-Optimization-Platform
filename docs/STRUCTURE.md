# Repository structure

What every folder and file does. The compressed version is in the
[root README](../README.md#8-repository-map).

```
ev/
├── data/                 the dataset (raw is committed, processed is regenerated)
├── notebooks/            9 worked-analysis notebooks (one per module + EDA + features)
├── src/evcharging/       the Python package — all reusable logic
├── scripts/              3 command-line entry points that drive the package
├── api/                  the FastAPI service
├── web/                  the Next.js dashboard
├── models/               trained model artifacts (git-ignored, regenerated)
├── tests/                pytest suite for the package
├── docs/                 this documentation
├── .github/workflows/    CI
└── project config        pyproject.toml, requirements.txt, Makefile, docker-compose.yml, .dockerignore
```

---

## `data/`

| Path | What it is |
| --- | --- |
| `data/raw/ev_charging_patterns.csv` | The single source: 1,320 synthetic charging sessions, 20 columns. **Committed.** From [Kaggle](https://www.kaggle.com/datasets/valakhorasani/electric-vehicle-charging-patterns). |
| `data/processed/sessions_clean.parquet` | 1,320 × 57 — canonical names, engineered features, 9 validation flags. Git-ignored; written by `scripts/prepare_data.py`. |
| `data/processed/validation_report.json` | Per-rule violation counts and percentages. Git-ignored. |
| `data/processed/analytics.json` | The precomputed dashboard payload. Git-ignored; written by `scripts/train_all.py` / `build_analytics.py`. |
| `data/README.md` | Full column dictionary and every known data-quality issue. |

## `notebooks/`

Each notebook imports from `src/evcharging/` (via `sys.path`), re-shows every step, and
explains its technique in blog-style prose (rules in the root `STYLE_GUIDE.md` and
`CODE_STYLE.md`).

| Notebook | Module | Covers |
| --- | --- | --- |
| `01_eda.ipynb` | — | Exploratory data analysis: validation, physics checks, distributions |
| `02_feature_engineering.ipynb` | — | The `build_features` pipeline, step by step, asserted |
| `03_energy_prediction.ipynb` | B | Energy regressor: 4 models, 5-fold CV, SHAP |
| `04_duration_prediction.ipynb` | C | Duration regressor, same structure |
| `05_session_segmentation.ipynb` | D | K-Means, elbow + silhouette, cluster profiling |
| `06_anomaly_detection.ipynb` | E | Isolation Forest + rules, reconciliation |
| `07_demand_forecasting.ipynb` | F | Hourly series, lag features, walk-forward |
| `08_recommendation_engine.ipynb` | G | The physics estimators and `recommend()` |
| `09_operator_analytics.ipynb` | A | Building `analytics.json` |

## `src/evcharging/`

The package. Every import path below is `evcharging.<...>`.

| Path | Responsibility |
| --- | --- |
| `__init__.py` | Package marker + version. |
| `config.py` | All paths, canonical column names, category lists, and validation thresholds — the single source of truth for constants. |
| `data/__init__.py` | Re-exports the loader and validators. |
| `data/load.py` | `load_raw()` — read CSV, rename headers, fix the mojibake `Temperature (°C)` header, parse timestamps, compute `duration_hours` from `end − start`. |
| `data/validate.py` | `FLAG_COLUMNS`, `add_validation_flags()`, `build_validation_report()` — the 9 domain rules and the report. |
| `features/__init__.py` | Re-exports the feature builders. |
| `features/build.py` | `add_time_parts`, `add_consistency_features`, `add_encodings`, `build_features` (runs all three), `impute_predictors` (deferred, per-model). |
| `models/__init__.py` | Re-exports the five model modules. |
| `models/common.py` | `regression_metrics` (MAE/RMSE/R²), `kfold_regression` (explicit K-fold loop), `save_artifact`/`load_artifact` (joblib), `write_metrics` (merges into `metrics.json`). |
| `models/regression.py` | Shared 4-model suite (mean / linear / random forest / XGBoost), `prepare_xy`, `feature_row` (build a 1-row predictor frame), `run_suite`. |
| `models/energy.py` | `train()` for the `energy_kwh` regressor → `energy_regressor.joblib`. |
| `models/duration.py` | `train()` for the `duration_hours` regressor → `duration_regressor.joblib`. |
| `models/segmentation.py` | `search_k`, `choose_k`, `fit_segmentation`, `name_archetypes`, `train()` → `session_segmenter.joblib`. |
| `models/anomaly.py` | `ANOMALY_FEATURES`, `HARD_FLAG_COLUMNS`, `fit_anomaly`, `explain_row` (reason strings), `reconcile`, `train()` → `session_anomaly.joblib`. |
| `models/demand.py` | `build_hourly_demand`, `walk_forward`, `forecast_horizon` (recursive N-hour forecast), `train()` → `demand_forecaster.joblib`. |
| `recommendation/__init__.py` | Re-exports the engine. |
| `recommendation/strategy.py` | Pure estimators (`estimate_energy_kwh`, `estimate_duration_hours`, `estimate_cost_usd`, `recommend_charger_type`, `best_charging_window`) + `recommend()`, `recommend_batch()`, `compare_chargers()`, `load_context()`. |
| `analytics/__init__.py` | Re-exports the aggregators. |
| `analytics/aggregate.py` | `overview`, `patterns`, `locations`, `segments`, `anomalies`, `build_analytics` (all sections), `write_analytics`. |

## `scripts/`

Each script adds `src/` to `sys.path` itself, so it runs from the repo root without
`pip install -e .`.

| Script | Does |
| --- | --- |
| `prepare_data.py` | raw CSV → `sessions_clean.parquet` + `validation_report.json`. |
| `train_all.py` | Trains + cross-validates every model, persists artifacts, writes `metrics.json`, refreshes `analytics.json`. `--track` adds MLflow logging. |
| `build_analytics.py` | Rebuilds only `analytics.json`. |

## `api/`

| Path | Responsibility |
| --- | --- |
| `__init__.py` | Adds `src/` to `sys.path` so `uvicorn api.app:app` works from a checkout. |
| `app.py` | `create_app()` — CORS, exception handlers (`ValueError → 422`, missing artifacts → `503`), startup lifespan that builds `AppState`. Exposes `app`. |
| `state.py` | `AppState.load()` — loads the 5 models + `analytics.json` + `metrics.json` + the parquet once; derives a per-session anomaly table and an hourly demand series. |
| `routes.py` | One `APIRouter` with all 10 endpoints; thin handlers calling into `evcharging`. |
| `schemas.py` | Pydantic v2 request/response models; vehicle/location/user-type are `Literal` enums from `evcharging.models.regression`. |
| `tests/conftest.py` | Session-scoped `TestClient` fixture; skips the module if artifacts are missing. |
| `tests/test_api.py` | 15 tests — every endpoint, query filters, validation failures, OpenAPI completeness. |
| `Dockerfile` | `python:3.12-slim`; runs the 3 pipeline scripts at build so the image is self-contained. |
| `README.md` | Endpoint table, configuration, Docker, tests. |

## `web/`

Next.js App Router + TypeScript + Tailwind v4 + Recharts.

| Path | Responsibility |
| --- | --- |
| `app/layout.tsx` | Root layout: theme provider + `AppShell` (nav + footer) + Geist fonts. |
| `app/page.tsx` | Redirects `/` → `/overview`. |
| `app/globals.css` | OKLCH design tokens (light/dark), Tailwind import, sheet animations. |
| `app/overview/page.tsx` | Stat grids, hourly-energy chart, data-quality bar, service status. |
| `app/analytics/page.tsx` + `analytics-view.tsx` | Tabbed breakdowns (time / weekday / charger / vehicle / city). |
| `app/segments/page.tsx` | Cluster archetype cards + table. |
| `app/anomalies/page.tsx` + `anomalies-table.tsx` | Sortable / risk-filterable table with a slide-in reason drawer. |
| `app/forecast/page.tsx` + `forecast-chart.tsx` | 72 h actual vs 24 h recursive forecast line chart. |
| `app/my-charging/page.tsx` + `charging-form.tsx` | Driver form → `POST /recommend` → plan + charger comparison. |
| `components/app-shell.tsx` | Top nav (operator + driver links), product mark, theme toggle. |
| `components/theme-provider.tsx` / `theme-toggle.tsx` | `next-themes`, `data-theme` attribute. |
| `components/charts.tsx` | `BarChartCard`, `AreaChartCard`, `Sparkline` — Recharts wrappers on the project palette. |
| `components/stat.tsx` | `StatGrid` / `Stat` / `MiniBar` — the KPI treatment (shared hairline dividers). |
| `components/page-header.tsx`, `states.tsx` | Page title / section headings; `states.tsx` = the API-error + empty-state cards. |
| `components/ui/*` | shadcn/ui-style primitives (owned source, radix-ui + cva): `card`, `button`, `badge`, `table`, `tabs`, `field`, `separator`, `sheet`, `skeleton`. |
| `lib/api.ts` | Typed API client. `ApiError`; browser uses `NEXT_PUBLIC_API_BASE_URL`, SSR uses `INTERNAL_API_BASE_URL`. |
| `lib/types.ts` | TypeScript types mirroring `api/schemas.py`. |
| `lib/utils.ts` | `cn()` (class merge), `num()`, `usd()` formatters. |
| `Dockerfile` | Multi-stage `output: "standalone"` build. |
| `next.config.ts` | `output: "standalone"`, `agentRules: false`. |
| `README.md` | Pages, design decisions, local run. |

## `models/`

Git-ignored (only `.gitkeep` is committed). Regenerated by `scripts/train_all.py`:
5 `.joblib` artifacts, `metrics.json`, `shap_energy_summary.png`,
`shap_duration_summary.png`.

## `tests/`

| File | Covers |
| --- | --- |
| `conftest.py` | Shared `raw_df` fixture. |
| `test_load.py` | Loading, renaming, timestamp parsing, true duration. |
| `test_validate.py` | The 9 flags; asserts the known counts (190, 268, 32). |
| `test_features.py` | Time parts, consistency ratios, encodings, imputation. |
| `test_models.py` | `kfold_regression` determinism, `prepare_xy` (no leakage), segmentation, anomaly scores/reasons, demand forecast. |
| `test_recommendation.py` | Every pure estimator + `recommend` end to end. |
| `test_analytics.py` | Each `aggregate` section + JSON-serialisability. |

## `docs/`

| Path | Contents |
| --- | --- |
| `SETUP.md` | This install guide with gotchas. |
| `WALKTHROUGH.md` | Every command with expected output. |
| `STRUCTURE.md` | This file. |
| `BRIEF.md` | The original brief, annotated with what shipped. |
| `spec/architecture.md` | System design, data flow, module responsibilities. |
| `spec/BUILD_LOG.md` | The 6 build phases, what each delivered and why. |
| `results/FINDINGS.md` | Why the metrics look the way they do; the key findings. |
| `results/BENCHMARK_RESULTS.md` | Full per-model metrics table from `metrics.json`. |
| `screenshots/` | Dashboard screenshots used in the README. |

## Project config (repo root)

| File | Purpose |
| --- | --- |
| `pyproject.toml` | Package metadata, dependencies + extras, pytest config, Ruff config. |
| `requirements.txt` | Flat dependency list (alternative to the extras). |
| `Makefile` | Task shortcuts (`make help`). |
| `docker-compose.yml` | api + web services. |
| `.dockerignore` | Build-context excludes (shared by both Dockerfiles). |
| `.github/workflows/ci.yml` | CI: python job (lint + pipeline + tests) and web job (lint + build). |
| `PLAN.md` | The 6-phase plan + the original brief in its appendix. |
| `STYLE_GUIDE.md` / `CODE_STYLE.md` | Prose and code conventions for the notebooks. |
