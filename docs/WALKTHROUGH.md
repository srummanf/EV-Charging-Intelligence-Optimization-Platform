# Walkthrough

Every script and check, in order, with the output you should see. Run from the repo
root with the venv active (see [SETUP.md](SETUP.md)). Numbers are from a clean run and
are deterministic (`random_state = 42` everywhere).

---

## Step 1 — Build the processed dataset

```bash
python scripts/prepare_data.py
```

Expected output (abridged):

```
loaded 1,320 rows, 21 columns
built features -> 57 columns
validation: 1,296 / 1,320 rows (98.18%) violate at least one rule
{
  "flag_energy_exceeds_capacity":        { "count": 190, "pct": 14.39 },
  "flag_soc_not_increasing":             { "count": 268, "pct": 20.3  },
  "flag_soc_out_of_range":               { "count": 32,  "pct": 2.42  },
  "flag_duration_mismatch":              { "count": 951, "pct": 72.05 },
  "flag_power_mismatch":                 { "count": 783, "pct": 59.32 },
  "flag_soc_energy_mismatch":            { "count": 871, "pct": 65.98 },
  "flag_battery_capacity_out_of_range":  { "count": 13,  "pct": 0.98  },
  "flag_temperature_out_of_range":       { "count": 2,   "pct": 0.15  },
  "flag_missing_values":                 { "count": 189, "pct": 14.32 }
}
wrote data/processed/sessions_clean.parquet
wrote data/processed/validation_report.json
```

Creates:

- `data/processed/sessions_clean.parquet` — 1,320 rows × 57 columns
- `data/processed/validation_report.json` — the counts above

---

## Step 2 — Train and evaluate all five models

```bash
python scripts/train_all.py          # ~25 s
```

Expected output (separator lines condensed; the numbers are exact and deterministic):

```
loaded 1,320 sessions from sessions_clean.parquet

===== Energy regressor  (target: energy_kwh) =====
  baseline_mean          MAE  19.080 +/- 0.375   RMSE  22.398   R2 -0.002
  linear_regression      MAE  19.330 +/- 0.386   RMSE  22.690   R2 -0.029
  random_forest          MAE  19.366 +/- 0.364   RMSE  22.940   R2 -0.052
  xgboost                MAE  20.183 +/- 0.371   RMSE  24.266   R2 -0.178
  -> best: baseline_mean

===== Duration regressor  (target: duration_hours) =====
  baseline_mean          MAE   0.874 +/- 0.037   RMSE   1.008   R2 -0.003
  linear_regression      MAE   0.883 +/- 0.036   RMSE   1.021   R2 -0.029
  random_forest          MAE   0.887 +/- 0.043   RMSE   1.027   R2 -0.042
  xgboost                MAE   0.918 +/- 0.043   RMSE   1.076   R2 -0.142
  -> best: baseline_mean

===== Session segmentation  (KMeans) =====
   k   inertia   silhouette
   2  6923.863     0.126
   3  6280.280     0.117
   4  5830.148     0.115
   5  5410.548     0.123
   6  5076.038     0.126
   7  4796.722     0.125
   8  4567.737     0.129
  -> k = 4, silhouette = 0.115
     cluster 0: Short fast high-energy sessions (n=340)
     cluster 1: Long fast low-energy sessions (n=316)
     cluster 2: Short slow high-energy sessions (n=343)
     cluster 3: Long slow low-energy sessions (n=321)

===== Anomaly detection  (IsolationForest) =====
  ML-flagged 264, hard-rule 441
  precision 0.470  recall 0.281  f1 0.352

===== Demand forecasting  (GradientBoosting, walk-forward) =====
  hourly points: 1296
  model          MAE 19.58
  mean baseline  MAE 18.71
  seasonal-naive MAE 25.19

===== Dashboard analytics  (precomputed payload) =====
  overview, patterns, locations, segments, anomalies -> analytics.json

===== Done in ~25s =====
artifacts + metrics.json + analytics.json refreshed
```

Creates: `models/energy_regressor.joblib`, `duration_regressor.joblib`,
`session_segmenter.joblib`, `session_anomaly.joblib`, `demand_forecaster.joblib`,
`models/metrics.json`, `models/shap_energy_summary.png`,
`models/shap_duration_summary.png`, and refreshes
`data/processed/analytics.json`.

**How to read the numbers:** compare each model's MAE to `baseline_mean`. Here they are
equal or worse — the dataset has no learnable signal. This is expected and explained in
[results/FINDINGS.md](results/FINDINGS.md).

Optional: `python scripts/train_all.py --track` additionally logs each model as an
MLflow run to `sqlite:///mlflow.db`.

---

## Step 3 — Rebuild only the dashboard payload (optional)

```bash
python scripts/build_analytics.py
```

Expected:

```
sessions        1,320
total energy    53,474 kWh
peak hour       04:00
top location    Los Angeles
segments        4
anomaly high    33
wrote data/processed/analytics.json
```

Faster than a full `train_all` when only `evcharging.analytics.aggregate` changed.

---

## Step 4 — Run the tests

```bash
pytest -q
```

Expected:

```
.....................................................................  [100%]
69 passed in ~25s
```

54 tests in `tests/` (data, features, models, recommendation, analytics) + 15 in
`api/tests/` (`TestClient` coverage for every endpoint). The API tests require the
artifacts from Step 2; if they are missing those tests **skip** rather than fail.

```bash
ruff check .           # -> All checks passed!
```

---

## Step 5 — Start the API

```bash
uvicorn api.app:app --reload
```

Then, in another terminal:

```bash
curl -s http://localhost:8000/health
# {"status":"ok","models_loaded":["energy_regressor.joblib", ... ],"n_sessions":1320, ...}

curl -s "http://localhost:8000/analytics/overview" | python -m json.tool
# { "n_sessions": 1320, "n_stations": 462, "total_energy_kwh": 53474.19, "peak_hour": 4, ... }

curl -s -X POST http://localhost:8000/recommend \
  -H 'content-type: application/json' \
  -d '{"vehicle_model":"Nissan Leaf","battery_capacity_kwh":40,"soc_start_pct":35,"soc_target_pct":90,"earliest_hour":20,"hours_available":10}'
# {"recommended_charger":"Level 2","estimated_energy_kwh":24.44,"charging_window":"05:00-09:00", ... }
```

Interactive docs: <http://localhost:8000/docs>.

If you skipped Step 2, `/health` and `/docs` still work but data routes return **503**
with a message telling you to run `scripts/train_all.py`.

---

## Step 6 — Start the dashboard

```bash
cd web
npm run dev            # http://localhost:3000  (the API from Step 5 must be running)
```

Open <http://localhost:3000>. Six pages: Overview, Analytics, Segments, Anomalies,
Forecast, My Charging. If the API is not running, every data page shows an inline
"Couldn't load this data" card instead of crashing. Screenshots:
[`docs/screenshots/`](screenshots).

---

## Step 7 — The notebooks (optional)

```bash
jupyter lab notebooks/
```

Open `01_eda.ipynb` and run all cells top to bottom (`Kernel → Restart & Run All`). Each
notebook is self-contained, explains its technique in prose, and reproduces the
corresponding module's results. Order: `01` EDA → `02` features → `03`–`07` one model
each → `08` recommendation engine → `09` operator analytics.

---

## One-command equivalents

```bash
make pipeline        # Steps 1 + 2
make test            # Step 4
make lint            # ruff + web eslint
make api             # Step 5
make web             # Step 6
make help            # list all targets
```
