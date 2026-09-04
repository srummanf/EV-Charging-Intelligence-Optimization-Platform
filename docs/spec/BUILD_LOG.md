# Build log

How the project was built: the six phases from [`../../PLAN.md`](../../PLAN.md), what
each delivered, and the reasoning behind the non-obvious choices. This is a
phase-by-phase log, not a per-commit one — the git history has two squashed commits
(`bc05278` phases 1–3, `a3583ed` phases 4–6).

The delivery order was deliberate: **phases 1–3 first (the ML substance), review, then
4–6 (the app and packaging).**

---

## Phase 1 — Foundation: data + features

**Delivered:** `evcharging.config`, `evcharging.data.load`, `evcharging.data.validate`,
`evcharging.features.build`, `scripts/prepare_data.py`, `notebooks/01_eda.ipynb`,
`notebooks/02_feature_engineering.ipynb`, `tests/test_load.py`, `test_validate.py`,
`test_features.py`.

**Key decisions**

- **Measure, don't repair.** EDA found ~98% of rows break at least one charging-physics
  rule. Rather than "clean" numbers that cannot be recovered, the validation layer turns
  each rule into a boolean flag and a `validation_report.json`. Those flags later become
  the anomaly module's ground truth.
- **Trust the timestamps, not the reported duration.** `Charging Duration (hours)`
  disagrees with `end − start` on ~72% of rows, so `load_raw` computes `duration_hours`
  itself and the reported column is kept only for comparison.
- **Fix the header byte.** `Temperature (°C)` contains a raw Latin-1 `0xB0`; the loader
  matches the column by `Temperature` prefix instead of the exact string.
- **Defer imputation.** `sessions_clean.parquet` keeps missing values as `NaN`; each
  model drops rows on its own target and imputes predictors on its own subset, so no
  global median leaks across tasks.

---

## Phase 2 — The five models

**Delivered:** `evcharging.models.{common,regression,energy,duration,segmentation,
anomaly,demand}`, `scripts/train_all.py`, `models/metrics.json`,
`notebooks/03`–`07`, `tests/test_models.py`.

**Key decisions**

- **Always ship a baseline.** `models.common.regression_metrics` and the 4-model suite
  (mean / linear / random forest / XGBoost) mean every regression result is reported
  next to the mean baseline. On this data no model beats it — see
  [../results/FINDINGS.md](../results/FINDINGS.md).
- **Explicit K-fold, not `cross_val_score`.** `kfold_regression` runs the loop by hand
  so the per-fold spread is visible and the notebooks can show it.
- **`k` by elbow + silhouette, with a parsimony fallback.** The silhouette is ~0.12 for
  every `k` from 2 to 8, so `choose_k` returns `k = 4` (a readable number of archetypes)
  rather than chasing a meaningless maximum.
- **Anomaly = rules + ML, reconciled.** The Isolation Forest is scored against 5 *hard*
  physical rules (not all 9 — the two "these columns disagree" rules would be circular).
  Precision 0.47 / recall 0.28 is the intended outcome: the model surfaces rare oddities
  the rules miss; it is not meant to reproduce the rules.
- **Demand = energy per hour, not session count.** The timestamps are a perfect 55 × 24
  grid, so session count has zero variance. `models.demand` aggregates `energy_kwh` to
  the hour and validates walk-forward against a seasonal-naive baseline.
- **`train_all.py` is the orchestrator.** One command trains everything, picks the best
  per task, writes artifacts + `metrics.json`, and refreshes `analytics.json`.

---

## Phase 3 — Recommendation engine + analytics layer

**Delivered:** `evcharging.recommendation.strategy`, `evcharging.analytics.aggregate`,
`scripts/build_analytics.py`, `notebooks/08`, `09`, `tests/test_recommendation.py`,
`test_analytics.py`.

**Key decisions**

- **Physics, not the ML models.** Because the regressors do not beat baselines, the
  recommendation engine estimates energy from `SOC gap × capacity ÷ efficiency`,
  duration from `energy ÷ nominal charger power`, and cost from a data-calibrated
  `$/kWh`. The trained energy model is consulted only as a sanity band ("the population
  average for a session like this is ~X kWh").
- **Slowest charger that fits.** Battery health and cost both favour slower charging, so
  `recommend_charger_type` steps up from Level 1 only when the time budget forces it.
- **Pure, unit-tested functions.** Every estimator takes plain numbers and returns plain
  numbers; `recommend()` is a thin wrapper that loads artifacts via `load_context()`.
- **Precompute analytics.** `analytics.aggregate` produces the exact JSON the dashboard
  needs so the API never runs pandas per request.
- Two notebooks beyond the plan's 01–07 list (`08`, `09`) to demonstrate the engine and
  the analytics payload.

---

## Phase 4 — FastAPI service

**Delivered:** `api/{app,state,routes,schemas}.py`, `api/tests/`, `api/Dockerfile`,
`api/README.md`. New package helpers: `models.regression.feature_row`,
`models.demand.forecast_horizon`.

**Key decisions**

- **Load once, serve fast.** `AppState.load()` reads all artifacts at startup and
  derives the per-session anomaly table and the demand-by-hour series. Handlers are thin.
- **Degrade, don't crash.** If artifacts are missing the app still boots; `/health` and
  `/docs` work and data routes return `503` with the fix.
- **Pydantic enums from the package.** Vehicle / location / user-type `Literal`s are
  derived from `evcharging.models.regression` constants so the schema can't drift.
- **`TestClient` for every endpoint**, including validation failures and OpenAPI
  completeness — 15 tests.
- **Self-contained image.** `api/Dockerfile` runs the three pipeline scripts at build so
  the container needs no volumes.

---

## Phase 5 — Next.js dashboard

**Delivered:** `web/` — 6 pages, `lib/api.ts` typed client, `components/ui/` primitives,
`web/Dockerfile`, `web/README.md`.

**Key decisions**

- **shadcn/ui "new-york" style, primitives owned as source.** Built on the unified
  `radix-ui` package + `class-variance-authority` (the shadcn CLI itself was too slow in
  this environment). Dark-first OKLCH token system in `globals.css`, Geist Sans + Geist
  Mono, a single blue accent. `components/ui/`: card, button, badge, table, tabs,
  field, separator, sheet, skeleton. Stats share hairline dividers (`stat.tsx`) rather
  than floating as cards; the anomaly reason drawer is a Radix `Sheet`.
- **Server Components for data, Client Components for interaction.** Data pages fetch on
  the server; only `anomalies` (sort + drawer), `forecast` (chart), and `my-charging`
  (form) ship client JS.
- **Chart palette is validated.** The categorical colours (blue / orange / aqua) passed
  a colour-blindness check in both light and dark; they are CSS variables so they swap
  with the theme.
- **Graceful API-down.** `lib/api.ts` throws `ApiError`; every page renders an inline
  "Couldn't load this data" card instead of a stack trace.
- **API change for this phase:** `/forecast` also returns `history` (the last 72 actual
  hourly points) so the chart can show *actual vs forecast*.

---

## Phase 6 — Packaging & docs

**Delivered:** `docker-compose.yml`, `web/Dockerfile`, `Makefile`,
`.github/workflows/ci.yml`, MLflow `--track` in `train_all.py`,
`docs/screenshots/`, this documentation set.

**Key decisions**

- **One compose file, two build args.** `NEXT_PUBLIC_API_BASE_URL` (baked, must be
  reachable from the browser) and `INTERNAL_API_BASE_URL` (`http://api:8000`, used by
  the dashboard's server-side rendering). `lib/api.ts` picks between them by
  `typeof window`.
- **CI is the release gate.** The python job runs the *entire* offline pipeline from
  scratch before the tests, so a green run proves reproducibility, not just that the
  current artifacts happen to pass.
- **MLflow behind a flag, SQLite backend.** Recent MLflow deprecated the bare-directory
  store, so `--track` defaults to `sqlite:///mlflow.db`.

### Known follow-ups

- `.dockerignore` still excludes `web/`, which breaks `docker compose build web` from a
  clean clone. A one-line fix is staged in the working tree and needs committing.
- No `LICENSE` file yet.
- Web test coverage is lint + build only.
