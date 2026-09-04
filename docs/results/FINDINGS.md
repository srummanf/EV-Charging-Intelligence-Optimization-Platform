# Findings

Why the model metrics look the way they do, and what to take from them. The numbers
themselves are in [BENCHMARK_RESULTS.md](BENCHMARK_RESULTS.md); regenerate them with
`python scripts/train_all.py`.

## The headline

**On this dataset, the predictive models cannot beat trivial baselines — and that is a
finding, not a bug.** The dataset
([Electric Vehicle Charging Patterns](https://www.kaggle.com/datasets/valakhorasani/electric-vehicle-charging-patterns),
Kaggle) is synthetic and was generated column by column, so the cross-column
relationships a real charging network would have are absent.

## Finding 1 — The data is internally inconsistent

The nine validation rules (`evcharging.data.validate`) fire on **1,296 of 1,320 rows
(98.2%)**:

| Rule | Rows | % |
| --- | --- | --- |
| Reported duration ≠ `end − start` (> 0.5 h) | 951 | 72.0 |
| SOC-implied energy ≠ measured energy (> 50%) | 871 | 66.0 |
| `rate × duration` ≠ energy (> 50%) | 783 | 59.3 |
| SOC did not increase during the session | 268 | 20.3 |
| Energy consumed > battery capacity | 190 | 14.4 |
| One of energy / rate / distance missing | 189 | 14.3 |
| SOC reading outside 0–100% | 32 | 2.4 |
| Battery capacity outside 10–150 kWh | 13 | 1.0 |
| Temperature outside −30…60 °C | 2 | 0.15 |

**Takeaway:** the reported `Charging Duration` column is unusable (the project computes
`duration_hours` from timestamps instead), and the physics identities that link energy,
rate, duration, and SOC do not hold.

## Finding 2 — The timestamps are a perfect grid

Every hour from 2024-01-01 00:00 to 2024-02-24 23:00 has **exactly one** session:
55 days × 24 hours = 1,320 rows. Session *count* per hour has zero variance.

**Takeaway:** demand forecasting cannot target session count — there is nothing to
predict. It targets **energy per hour**, network-wide.

## Finding 3 — Targets are uncorrelated with every feature

`energy_kwh` and `duration_hours` have `|correlation| < 0.05` with every predictor,
including the physically meaningful ones (`soc_delta_pct × battery_capacity`,
`charging_rate_kw`, `distance_km`). The hourly energy series has autocorrelation
indistinguishable from zero at every lag, including 24 h and 168 h.

**Takeaway:** no function maps the features to the targets, so no model — linear, random
forest, or gradient boosting — can do better than predicting the mean.

## What each model shows

| Model | Result | Reading |
| --- | --- | --- |
| **Energy regressor** | best CV MAE = `baseline_mean` (19.08 kWh); every learned model has slightly negative R² | The shipped "model" is effectively the population mean; the recommendation engine uses physics. |
| **Duration regressor** | same — baseline MAE 0.87 h, learned models worse | Same conclusion. |
| **Segmentation** | silhouette ≈ 0.12 for `k` = 2…8 | The 4 archetypes are descriptive slices of one continuous cloud, useful as a lens, not distinct personas. |
| **Anomaly detection** | precision 0.47 / recall 0.28 vs 5 hard rules | *Good.* The model catches rare, extreme violations (out-of-range capacity, SOC) at high rates and common ones at the base rate. Rules + ML are complementary — the platform ships both plus a per-session reason string. |
| **Demand forecast** | GBM MAE 19.58; seasonal-naive 25.19; flat mean 18.71 | Beating seasonal-naive but not the mean confirms there is no trend or seasonality; the model learns the mean. |

## What this pipeline would do on real data

The method — validate, engineer features, compare against a baseline, cross-validate,
report the gap — is dataset-independent. On a real charging dataset with genuine
structure:

- the regressors would either beat their baselines (and by how much would be the result)
  or the same honest "no signal" conclusion would be reached with confidence;
- the demand forecaster would pick up the real evening-commute peak that `hour` /
  `weekday` / lag features encode;
- the segmentation silhouette would rise and the archetypes would sharpen.

The value delivered here is the **pipeline and the rigour**, verified end to end by CI on
every push.
