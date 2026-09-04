# EV Charging Intelligence & Optimization Platform — Implementation Plan

## Reality checks from the data (adjustments to the vision)

The dataset probes changed three of the modules originally sketched. These are not
blockers — they make the project more honest, which reads better:

1. **1,320 rows = 1,320 unique User IDs** — exactly one session per user. Per-user
   behavioral aggregation (Module D as written) is impossible. Reframe as
   **session-level behavioral segmentation**: cluster the *sessions* into archetypes
   (e.g. "fast DC top-ups", "long slow Level-1 charges", "deep-discharge long-distance
   trips"). Still a legitimate unsupervised-ML story with cluster profiling.
2. **462 stations for 1,320 sessions** (~2.8 each) — per-station demand forecasting is
   far too sparse to be credible. Forecast **network-level demand**, optionally split by
   the 5 locations, at hourly/daily granularity over the 55-day span (2024-01-01 to
   2024-02-24). Documented with its limitations.
3. **Known data-quality issues** — 190 rows where energy consumed exceeds battery
   capacity, 268 where SOC decreases during charging, the "Charging Duration" column
   disagrees with end-start timestamps by ~1.2 h on average, and 66 missing values in
   each of 3 columns. These become the backbone of the **anomaly module** and a data-
   validation section that makes the project look mature.
4. Small data -> classic ML (linear / random forest / XGBoost), no deep learning.
   Metrics will be modest; the value is the pipeline, the honesty, and the end-to-end system.

## Positioning

**EV Charging Intelligence & Optimization Platform** — an end-to-end ML system that
validates and analyzes EV charging sessions, predicts session energy and duration,
segments charging behavior, flags anomalous sessions with domain-rule explanations,
forecasts network charging demand, and turns those models into charging recommendations,
served through a FastAPI backend and a Next.js/shadcn dashboard.

Resume line: *EV Charging Intelligence & Optimization Platform | Python, pandas,
scikit-learn, XGBoost, SHAP, FastAPI, Next.js, shadcn/ui, Docker*

## Style guides (must follow)

The repo already contains `STYLE_GUIDE.md` (prose) and `CODE_STYLE.md` (code). All
notebooks in this plan follow them exactly:

- **Prose** — blog-post voice, define-then-use, blockquote definitions, say *why* not
  just *what*, every plot/table followed by an `Observations` or takeaway list, no hype
  words, lines wrapped ~90-100 chars. The explanation is the product; code is secondary.
- **EDA notebook** (`notebooks/01_eda.ipynb`) — fixed section order from `CODE_STYLE.md`:
  Loading Data -> Basic Data Exploration (shape, head/tail, dtypes, missing %, duplicates,
  uniqueness, describe) -> Areas to Fix -> Data Preprocessing (each fix + an `assert`
  cell) -> Data Analysis (one sub-section per question, each ending in Observations) ->
  Conclusion (Insights / Suggestions / Possible Next Steps).
- **ML notebooks** (`02_`+) — linear sequence of one-idea cells, imports where first
  needed, every object shown after creation, `random_state=` everywhere, hyperparameter
  tuning written as an explicit train/validation loop (not hidden in `GridSearchCV`),
  each section ends with an interpretation cell.
- Reusable logic lives in `src/evcharging/`; notebooks import from it for the
  production path but still show the worked steps inline per the ML template.

## Stack (all confirmed available on this machine)

Python 3.12 - pandas - scikit-learn 1.9 - xgboost 3.4 - shap - matplotlib/seaborn -
FastAPI + uvicorn - pydantic v2 - joblib - pytest — Node 23 - Next.js (App Router, TS) -
Tailwind - shadcn/ui - Recharts — git (repo not yet initialized; plan will `git init`).

## Repo layout

```
ev/
├── data/{raw,processed}/
├── notebooks/            01_eda … 07_demand_forecasting
├── src/evcharging/
│   ├── data/             load.py, validate.py
│   ├── features/         build.py
│   ├── models/           energy.py, duration.py, segmentation.py,
│   │                     anomaly.py, demand.py
│   ├── recommendation/   strategy.py
│   └── analytics/        aggregate.py   (precomputes dashboard JSON)
├── scripts/              train_all.py, build_analytics.py
├── models/               *.joblib, metrics.json
├── api/                  FastAPI app, schemas, tests, Dockerfile
├── web/                  Next.js + shadcn frontend
├── tests/                pytest
├── pyproject.toml, requirements.txt, docker-compose.yml
├── .github/workflows/ci.yml
└── README.md
```

## Phase 1 — Foundation: data + features

- Scaffold repo, `git init`, `.gitignore`, `pyproject.toml` + `requirements.txt`,
  `src/evcharging/` package, move CSV to `data/raw/`.
- `data/load.py` — read CSV, fix the mojibake `Temperature (Â°C)` header, coerce types,
  parse both timestamps, compute true duration from end-start.
- `data/validate.py` — rule checks producing `validation_report.json` + per-row boolean
  flags: energy > battery capacity; SOC end <= SOC start; |duration_col - duration_ts|
  above threshold; |rate*duration - energy| mismatch; temperature / SOC out of range;
  missing-value map.
- `features/build.py` — timestamp parts (hour, weekday, month, is_weekend), SOC delta,
  energy-per-km, implied power (rate*duration), consistency ratios, one-hot / ordinal
  encodings for the 5 categoricals.
- Missing-value policy: drop a row only when that model's target is null; impute
  predictors (numeric -> median, categorical -> "unknown").
- Output `data/processed/sessions_clean.parquet`.
- `notebooks/01_eda.ipynb` — full EDA template, with the charging-physics consistency
  checks folded into "Areas to Fix" and "Data Preprocessing".
- `notebooks/02_feature_engineering.ipynb` — feature build walked through in ML-template
  style, each transformation shown and asserted.

## Phase 2 — Models

Each model = a module in `src/evcharging/models/`, a section in `scripts/train_all.py`,
a notebook, a `.joblib` artifact, and an entry in `models/metrics.json`.

- **Energy regressor** — target `Energy Consumed (kWh)`; models: mean baseline,
  LinearRegression, RandomForest, XGBoost; 5-fold CV; report MAE / RMSE / R2; SHAP
  summary plot saved to `models/`.
- **Duration regressor** — target = cleaned true duration; same model lineup and metrics.
- **Session segmentation** — feature subset -> StandardScaler -> KMeans; pick k via elbow +
  silhouette; produce a cluster-profile table and human-readable archetype names;
  persist scaler + model + labels.
- **Anomaly detection** — domain-consistency features + IsolationForest -> `anomaly_score`
  in [0,1]; generate rule-based reason strings; reconcile against Phase-1 validation flags
  (precision/recall of the ML model vs the hard rules).
- **Demand forecasting** — aggregate sessions to (date, hour[, location]); features: hour,
  weekday, is_weekend, temperature, lag-1 / lag-24 / rolling-mean; GradientBoosting or
  XGBoost regressor; walk-forward validation; MAE vs a seasonal-naive baseline; caveats
  section.
- `notebooks/03_energy_prediction … 07_demand_forecasting` — each follows the ML
  template (Load/inspect -> encode -> split -> fit -> predict -> evaluate -> importance/SHAP ->
  tuning loop) and opens with a blog-style explanation of the technique per
  `STYLE_GUIDE.md`.

## Phase 3 — Recommendation engine

- `recommendation/strategy.py` — input: vehicle model, battery capacity, SOC start,
  SOC target, distance, time, optional user/session context. Combines the energy model,
  duration model, demand forecast, and nearest segment to output: recommended charger
  type, best charging time window, estimated energy / duration / cost, and a reason
  string.
- Pure functions, fully unit-tested.

## Phase 4 — FastAPI service (`api/`)

- On startup, load `.joblib` artifacts + precomputed analytics JSON (from
  `scripts/build_analytics.py`).
- Endpoints: `GET /health`, `/analytics/overview`, `/analytics/patterns`,
  `/analytics/locations`, `/analytics/segments`, `/anomalies`, `/forecast`,
  `POST /predict/energy`, `POST /predict/duration`, `POST /recommend`.
- Pydantic v2 request/response schemas, CORS for the web app, structured error handling.
- `pytest` with `TestClient` covering every endpoint; `Dockerfile`.

## Phase 5 — Next.js + shadcn frontend (`web/`)

- Next.js App Router + TypeScript + Tailwind + shadcn/ui; charts via Recharts / shadcn
  charts, following the dataviz skill for palette, labels, and light/dark.
- Typed API client with env-configurable base URL.
- **Operator** pages: Overview (KPI cards), Charging Analytics (time-of-day, weekday,
  location, charger-type breakdowns), Session Segments (cluster profiles), Anomalies
  (sortable table + reason detail drawer), Demand Forecast (actual vs forecast chart).
- **User** view: "My Charging" form -> recommendation card.
- Responsive, theme-aware.

## Phase 6 — Packaging & docs

- `README.md`: one-liner, architecture diagram, module summaries, results table,
  screenshots, an explicit "Data limitations & honesty" section, run instructions.
- `docker-compose.yml` (api + web), task scripts / Makefile.
- `pytest` suite + GitHub Actions CI (ruff lint + pytest + a training smoke test).
- Optional MLflow logging in `train_all.py` behind a `--track` flag.
- Deployment notes for later (Vercel for `web/`, a container host for `api/`). Not
  deployed now, per "decide later".

## Defaults used unless objected to

- Python env: `venv` + `pip` + `requirements.txt` (not `uv`/conda).
- Frontend package manager: `npm`.
- MLflow: included but behind a flag.
- **Delivery order: build Phases 1-3 first (the ML core + notebooks — the resume
  substance), pause for review, then do Phases 4-6.**

---

# Appendix — Original Project Brief

The following is the original brief this plan is based on. Where it differs from the
plan above, the plan above wins — specifically: the app layer is **FastAPI + Next.js /
shadcn**, not Streamlit; user segmentation is **session-level**, not per-user (the data
has one session per user); demand forecasting is **network / location level**, not
per-station (462 stations, ~2.8 sessions each).

## Project Idea: EV Charging Intelligence & Optimization Platform

Build a single end-to-end ML platform that answers:

> "What is happening across EV charging infrastructure, why is it happening, what will
> happen next, and what should the operator/user do about it?"

Instead of making separate projects for prediction, clustering, and anomaly detection,
integrate them into one platform.

### 1. Core Platform

```text
                    EV Charging Data
                           │
                           ▼
              ┌────────────────────────┐
              │ Data Processing Layer   │
              │ Cleaning + Validation   │
              │ Feature Engineering     │
              └────────────┬───────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
       Analytics       ML Models      User Behavior
            │              │              │
            ▼              ▼              ▼
       KPI / EDA       Predictions       Clusters
            │              │              │
            └──────────────┼──────────────┘
                           ▼
                  Anomaly Detection
                           │
                           ▼
                 Demand Forecasting
                           │
                           ▼
              Charging Recommendations
                           │
                           ▼
                 Streamlit Dashboard
```

### 2. Platform Modules

**Module A — EV Charging Analytics**

Give operators a high-level view of the charging network.

Track:

* Total charging sessions
* Total energy consumed
* Average charging duration
* Average charging cost
* Average charging rate
* Average SOC increase
* Energy consumption by vehicle
* Energy consumption by charger
* Station utilization
* Peak charging periods
* Charging behavior by location
* Weekday vs weekend behavior

Example:

```text
Dashboard

Sessions             1,320
Energy Consumed      42,850 kWh
Avg Session          32.5 kWh
Avg Duration         1.21 hr
Avg Cost             $11.42

Peak Hour            18:00–20:00
Most Used Charger    Level 2
Highest Demand       New York
```

### 3. Module B — Charging Energy Prediction

Predict: How much energy will this charging session require?

Target:

```text
Energy Consumed (kWh)
```

Use features such as:

```text
Vehicle Model
Battery Capacity
SOC Start
SOC End
Distance Driven
Temperature
Vehicle Age
Charger Type
Time of Day
Day of Week
User Type
```

Compare:

```text
Baseline
Linear Regression
Random Forest
Gradient Boosting
XGBoost
```

Report:

```text
MAE
RMSE
R²
```

### 4. Module C — Charging Duration Prediction

Predict: How long will the charging session take?

Target:

```text
Charging Duration
```

This becomes useful for the eventual recommendation engine.

Example:

```text
Vehicle: Tesla Model 3
SOC: 25% → 80%
Charger: DC Fast

Predicted duration:
43 minutes
```

### 5. Module D — EV User Behavior Segmentation

Instead of treating all users identically, discover behavioral groups.

Aggregate data by:

```text
User ID
```

Create behavioral features:

```text
Average Energy/session
Average Distance
Average SOC Start
Average SOC End
Charging Frequency
Average Duration
Average Cost
Preferred Charger
Preferred Time
```

Then:

```text
Feature Engineering
       ↓
StandardScaler
       ↓
K-Means
       ↓
Optimal K
       ↓
Cluster Profiling
```

Potential segments:

```text
Cluster 0
Frequent Commuters

Cluster 1
Long-Distance Drivers

Cluster 2
Occasional Chargers

Cluster 3
Fast-Charging Users
```

The names should be assigned after analyzing cluster characteristics, not hard-coded
beforehand.

### 6. Module E — Charging Anomaly Detection

This is where the project gets more interesting. Identify sessions that don't look
physically or behaviorally normal.

Domain-based checks. For example:

$$Energy \approx ChargingRate \times Duration$$

and:

$$SOC_{increase} \approx \frac{Energy}{BatteryCapacity} \times 100$$

You can derive:

```text
Power Consistency Ratio
SOC-Energy Consistency
Energy/km
Charging Efficiency Proxy
```

Then use:

```text
Isolation Forest
```

to detect unusual sessions.

Output:

```text
Session #1042

Anomaly Score: 0.91
Risk: High

Reasons:
• Unusually high energy consumption
• SOC increase inconsistent with energy
• Charging rate outside normal vehicle pattern
```

This combines domain knowledge + ML, which is much stronger than using Isolation Forest
alone.

### 7. Module F — Charging Demand Forecasting

Now move from individual sessions to the charging infrastructure level.

Aggregate:

```text
Station × Date × Hour
```

Create:

```text
Sessions per hour
Energy demand per hour
Average charging duration
Average charging rate
Temperature
Day of week
Weekend
Hour
```

Predict: How much charging demand will the station experience?

Example:

```text
Station: ST-104

Current:
17:00 → 142 kWh

Forecast:
18:00 → 187 kWh
19:00 → 214 kWh
20:00 → 193 kWh
21:00 → 151 kWh
```

Now your platform can identify upcoming peak demand.

### 8. Module G — Charging Recommendation Engine

This connects all the previous modules.

Given:

```text
Vehicle
Current SOC
Target SOC
Distance
User Type
Current Time
```

the platform generates:

```text
Recommended Charging Strategy
```

For example:

```text
─────────────────────────────
Charging Recommendation
─────────────────────────────

Vehicle:
Tesla Model 3

Current SOC:
28%

Target SOC:
80%

Recommended Charger:
DC Fast Charger

Estimated Energy:
39.8 kWh

Estimated Duration:
41 minutes

Estimated Cost:
$12.40

Recommended Time:
20:30

Reason:
Lower predicted station demand
```

The recommendation can combine:

```text
Energy Prediction
+
Duration Prediction
+
Demand Forecast
+
User Behavior
+
Historical Charging Patterns
```

### 9. Operator Dashboard

Have two major perspectives.

Operator View:

```text
EV Charging Network
────────────────────────────────

NETWORK KPIs
Sessions       Energy       Cost
1,320          42.8 MWh    $15.2K

────────────────────────────────

Demand Forecast
        ▲
        │       ╭──╮
        │   ╭───╯  ╰──╮
        │───╯          ╰──
        └──────────────────→ Time

────────────────────────────────

Station Performance

Station    Sessions   Energy   Demand
ST-101       241      8.2MWh    High
ST-102       183      5.9MWh    Medium
ST-103       312      9.8MWh    High
```

Then:

```text
Anomaly Monitor

High Risk     7
Medium Risk   18
Normal        1,295
```

### 10. User View

The same platform can have a second interface:

```text
My Charging

Current SOC       28%
Target SOC        80%
Distance          120 km

        ↓

Recommended Charger
DC Fast Charger

        ↓

Expected Energy
39.8 kWh

Expected Duration
41 min

Expected Cost
$12.40

        ↓

Best Charging Window
20:30 – 21:15
```

### 11. Recommended Architecture

Don't make this just a notebook.

```text
ev-charging-platform/
│
├── data/
│   ├── raw/
│   ├── processed/
│   └── README.md
│
├── notebooks/
│   ├── 01_data_exploration.ipynb
│   ├── 02_feature_engineering.ipynb
│   ├── 03_energy_prediction.ipynb
│   ├── 04_duration_prediction.ipynb
│   ├── 05_user_segmentation.ipynb
│   ├── 06_anomaly_detection.ipynb
│   └── 07_demand_forecasting.ipynb
│
├── src/
│   ├── data/
│   ├── features/
│   ├── analytics/
│   ├── models/
│   │   ├── energy_prediction.py
│   │   ├── duration_prediction.py
│   │   ├── user_segmentation.py
│   │   ├── anomaly_detection.py
│   │   └── demand_forecasting.py
│   │
│   ├── recommendation/
│   │   └── charging_strategy.py
│   │
│   └── evaluation/
│
├── models/
│
├── app/
│   ├── dashboard.py
│   ├── pages/
│   │   ├── overview.py
│   │   ├── charging_analytics.py
│   │   ├── user_segments.py
│   │   ├── anomalies.py
│   │   ├── demand_forecast.py
│   │   └── recommendations.py
│   │
│   └── components/
│
├── tests/
│
├── requirements.txt
├── README.md
├── architecture.md
└── Dockerfile
```

### 12. ML Stack

Keep the stack realistic rather than adding technologies just for resume keywords.

Data: `Python`, `Pandas`, `NumPy`

Visualization: `Matplotlib`, `Seaborn`, `Plotly`

ML: `Scikit-learn`, `XGBoost`

Application: `Streamlit`

Model management (potentially): `Joblib`, `MLflow`

Testing: `Pytest`

Deployment (potentially): `Docker`

You don't need all of these. The important part is that each technology has a real
purpose.

### 13. The ML Architecture

Your README could ultimately show something like:

```text
                    RAW DATA
                       │
                       ▼
               Data Validation
                       │
                       ▼
              Feature Engineering
                       │
          ┌────────────┼─────────────┐
          │            │             │
          ▼            ▼             ▼
     Regression     Clustering    Anomaly ML
          │            │             │
          │            │             │
    ┌─────┴────┐       │        Isolation Forest
    │          │       │
 Energy     Duration   │
 Prediction Prediction  │
    │          │        │
    └─────┬────┘        │
          │             │
          └──────┬──────┘
                 ▼
          Demand Forecasting
                 │
                 ▼
       Charging Recommendation
                 │
                 ▼
            Streamlit App
```

### 14. What makes this resume-worthy

The strongest part isn't the number of models. It's the end-to-end reasoning:

* **Data Engineering** — transform raw session data into reliable ML features.
* **Statistical Analysis** — understand charging behavior.
* **Supervised ML** — predict energy, duration, demand.
* **Unsupervised ML** — discover user segments and charging anomalies.
* **Domain Knowledge** — introduce physical consistency checks instead of blindly
  trusting ML.
* **Decision System** — turn predictions into charging recommendations.
* **Software Engineering** — package the models into a modular application with reusable
  Python modules, tests, model artifacts, configuration, dashboard, documentation.

### 15. The final project positioning

Not "EV Charging Prediction using Machine Learning" — that's too narrow.

Position it as: **EV Charging Intelligence & Optimization Platform**

One-line description:

> An end-to-end ML platform that analyzes EV charging behavior, predicts energy and
> charging duration, segments users, detects anomalous sessions, forecasts station
> demand, and generates data-driven charging recommendations.

That gives a coherent project where analytics → ML → forecasting → anomaly detection →
recommendations → application all belong to the same system.

Resume stack: *EV Charging Intelligence & Optimization Platform | Python, Pandas,
Scikit-learn, XGBoost, Streamlit, MLflow, Docker*

The project realistically demonstrates Data Science + ML + ML Engineering + Software
Engineering, rather than looking like a collection of disconnected notebooks.
