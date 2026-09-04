# Project brief, annotated

The original brief is preserved in full in the appendix of
[`../PLAN.md`](../PLAN.md). This file summarises it and, for each part, records **what
actually shipped** and **why it differs**.

**Dataset:** [Electric Vehicle Charging Patterns](https://www.kaggle.com/datasets/valakhorasani/electric-vehicle-charging-patterns)
by Vala Khorasani (Kaggle) — synthetic; see [`../data/README.md`](../data/README.md).

## The idea

> Build a single end-to-end ML platform that answers: *"What is happening across EV
> charging infrastructure, why is it happening, what will happen next, and what should
> the operator/user do about it?"* — integrating prediction, clustering, and anomaly
> detection into one platform rather than separate projects.

**Shipped as stated.** One package (`evcharging`), one dataset, one feature table, seven
modules, an API, and a dashboard.

## Three brief-level deviations (decided up front from the data)

| Brief said | Shipped | Why |
| --- | --- | --- |
| Streamlit dashboard | **FastAPI + Next.js** | A real API + typed frontend is a stronger portfolio artifact and separates serving from UI. |
| **User** segmentation (aggregate by `User ID`) | **Session** segmentation | The dataset has exactly one session per user — there is nothing to aggregate. |
| **Per-station** demand forecasting | **Network-level, hourly** energy demand | 462 stations for 1,320 sessions (~2.8 each) is far too sparse; and the timestamps form a perfect hourly grid so session *count* is constant. |

## Module by module

### Module A — EV Charging Analytics

**Brief:** operator KPIs — total sessions, energy, average duration / cost / rate, SOC
increase, energy by vehicle / charger, station utilisation, peak periods, behaviour by
location, weekday vs weekend.

**Shipped:** `evcharging.analytics.aggregate` → `analytics.json` with `overview`,
`patterns` (hour / weekday / charger / vehicle), `locations`, `segments`, `anomalies`.
Served by `/analytics/*` and rendered on the dashboard's Overview + Analytics pages.
Station utilisation is reported as sessions-per-city + station counts rather than
per-station (too sparse).

### Module B — Charging Energy Prediction

**Brief:** predict `Energy Consumed (kWh)` from vehicle / battery / SOC / distance /
temperature / age / charger / time features; compare baseline, linear, random forest,
gradient boosting, XGBoost; report MAE / RMSE / R².

**Shipped:** `evcharging.models.energy` — mean baseline, linear regression, random
forest, XGBoost; 5-fold CV; MAE / RMSE / R² in `metrics.json`; SHAP summary plot.
Result: **no model beats the mean baseline** (see
[results/FINDINGS.md](results/FINDINGS.md)).

### Module C — Charging Duration Prediction

**Brief:** predict `Charging Duration`; useful for the recommendation engine.

**Shipped:** `evcharging.models.duration` — same 4-model line-up. Target is
`duration_hours` computed from the timestamps, **not** the unreliable reported column.
Also does not beat the baseline.

### Module D — Session Segmentation

**Brief:** discover behavioural groups; feature engineering → `StandardScaler` → K-Means
→ optimal `k` → cluster profiling; names assigned *after* analysis, not hard-coded.

**Shipped:** `evcharging.models.segmentation` — `StandardScaler` → K-Means on six
behavioural features; `k` chosen by elbow + silhouette (`k = 4`); archetype names
derived from each cluster's profile (`name_archetypes`). Silhouette ≈ 0.12, so the
clusters are presented as descriptive slices, not distinct personas.

### Module E — Charging Anomaly Detection

**Brief:** derive physical-consistency features (power consistency ratio, SOC–energy
consistency, energy/km, efficiency proxy), run Isolation Forest, output an anomaly score
+ risk level + reason strings. "Domain knowledge + ML is much stronger than Isolation
Forest alone."

**Shipped exactly.** `evcharging.models.anomaly` — 7 consistency features →
`StandardScaler` → Isolation Forest → `anomaly_score` in `[0, 1]`; `explain_row`
produces the reason strings; `reconcile` reports precision / recall against 5 hard
physical rules. The dashboard's Anomaly page shows the score, risk badge, and a reason
drawer.

### Module F — Demand Forecasting

**Brief:** aggregate `Station × Date × Hour`; features: sessions/hour, energy/hour,
duration, rate, temperature, day of week, weekend, hour; predict station demand.

**Shipped:** `evcharging.models.demand` — aggregate to `Date × Hour` **network-wide**
(not per-station); target is `energy_kwh` per hour; features are calendar + lag-1 /
lag-24 / 24-h rolling mean + temperature; GradientBoosting; **walk-forward** validation
against a seasonal-naive and a flat-mean baseline. Beats seasonal-naive, not the mean —
there is no trend or seasonality.

### Module G — Recommendation Engine

**Brief:** given vehicle, current SOC, target SOC, distance, user type, current time —
output a recommended charging strategy (charger type, estimated energy / duration /
cost, recommended time, reason), combining the energy model, duration model, demand
forecast, and user behaviour.

**Shipped:** `evcharging.recommendation.strategy` — because the regressors don't beat
baselines, the estimates come from **charging physics**; the demand forecast picks the
quietest hour; the segmenter provides an archetype label; the energy model is a sanity
band. Output matches the brief's format (charger, window, energy, duration, cost,
reason) plus a three-charger comparison table. Exposed as `POST /recommend` and the
dashboard's "My Charging" page.

## What makes it resume-worthy (from the brief)

The brief's own list — data engineering, statistical analysis, supervised ML,
unsupervised ML, domain knowledge, a decision system, software engineering — all
present. The honest evaluation ([results/FINDINGS.md](results/FINDINGS.md)) is the extra
piece: knowing when the data has no signal and saying so, rather than shipping an
overfit model.
