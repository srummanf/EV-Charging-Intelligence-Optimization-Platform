"""Demand forecasting - predict network charging energy per hour.

Module F, reframed. The brief forecasts per-station demand, but 462 stations over 1,320
sessions is far too sparse. And because the timestamps are a perfect hourly grid, the
*number* of sessions per hour is constant - there is nothing to forecast there either.
What does vary is the **energy** drawn each hour, so the target is ``energy_kwh``
aggregated to the hour across the whole network.

> **Walk-forward validation**
>
> For time series you cannot shuffle rows - that would let the model train on the future.
> Walk-forward validation instead trains on an initial stretch, predicts the next block,
> then expands the training window to include that block and repeats. Every prediction is
> genuinely out-of-sample and in temporal order.

The model (gradient-boosted trees) uses calendar features, temperature, and lagged
demand (1 hour and 24 hours back, plus a 24-hour rolling mean). It is scored against two
baselines: a flat mean and a **seasonal-naive** forecast (repeat the value from 24 hours
ago).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor

from evcharging.config import RANDOM_STATE
from evcharging.models.common import regression_metrics

LAG_FEATURES = ["lag_1", "lag_24", "roll_24_mean"]
CALENDAR_FEATURES = ["hour", "weekday", "is_weekend", "month", "temperature_c"]
DEMAND_FEATURES = CALENDAR_FEATURES + LAG_FEATURES
TARGET = "energy_kwh"


def build_hourly_demand(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate sessions to a complete hourly network-demand series.

    One row per hour from the first to the last session. ``energy_kwh`` is the sum of
    that hour's sessions (exactly one, on this grid); the 66 missing energy readings are
    linearly interpolated so the lag features are well defined. Adds the calendar and lag
    columns and drops the first 24 hours, which have no 24-hour lag.
    """
    hourly = (
        df.set_index("start_time")
        .sort_index()
        .assign(energy_kwh=lambda d: d["energy_kwh"])
        .resample("h")["energy_kwh"]
        .sum(min_count=1)
        .to_frame()
    )
    hourly["energy_kwh"] = hourly["energy_kwh"].interpolate("linear").bfill()

    idx = hourly.index
    hourly["hour"] = idx.hour
    hourly["weekday"] = idx.dayofweek
    hourly["is_weekend"] = (idx.dayofweek >= 5).astype(int)
    hourly["month"] = idx.month

    temp = df.set_index("start_time").sort_index()["temperature_c"].resample("h").mean()
    hourly["temperature_c"] = temp.reindex(hourly.index).interpolate("linear").bfill().ffill()

    hourly["lag_1"] = hourly["energy_kwh"].shift(1)
    hourly["lag_24"] = hourly["energy_kwh"].shift(24)
    hourly["roll_24_mean"] = hourly["energy_kwh"].shift(1).rolling(24).mean()

    return hourly.iloc[24:].dropna(subset=LAG_FEATURES)


def make_model(random_state: int = RANDOM_STATE) -> GradientBoostingRegressor:
    """Gradient-boosted regression trees, modest depth and learning rate for a short series."""
    return GradientBoostingRegressor(
        n_estimators=300,
        learning_rate=0.03,
        max_depth=3,
        subsample=0.8,
        random_state=random_state,
    )


@dataclass
class WalkForwardResult:
    n_splits: int
    model_metrics: dict[str, float]
    mean_baseline_metrics: dict[str, float]
    seasonal_naive_metrics: dict[str, float]
    predictions: pd.DataFrame  # index = timestamp, cols: actual, model, seasonal_naive

    def metrics_payload(self) -> dict:
        return {
            "target": "network energy_kwh per hour",
            "n_test_points": int(len(self.predictions)),
            "walk_forward_splits": self.n_splits,
            "features": DEMAND_FEATURES,
            "model": {"name": "GradientBoostingRegressor", **_round(self.model_metrics)},
            "baseline_mean": _round(self.mean_baseline_metrics),
            "baseline_seasonal_naive": _round(self.seasonal_naive_metrics),
            "model_vs_seasonal_naive_mae_ratio": round(
                self.model_metrics["mae"] / self.seasonal_naive_metrics["mae"], 4
            ),
        }


def _round(m: dict[str, float]) -> dict[str, float]:
    return {k: round(v, 4) for k, v in m.items()}


def walk_forward(
    hourly: pd.DataFrame,
    n_splits: int = 5,
    random_state: int = RANDOM_STATE,
) -> WalkForwardResult:
    """Expanding-window walk-forward evaluation over the last portion of the series.

    The series is split into ``n_splits + 1`` equal blocks. The model always trains on
    everything before the current test block; predictions are concatenated in time order
    and scored once at the end, alongside the two baselines.
    """
    X = hourly[DEMAND_FEATURES]
    y = hourly[TARGET]
    n = len(hourly)
    block = n // (n_splits + 1)

    rows = []
    for i in range(1, n_splits + 1):
        train_end = block * i
        test_slice = slice(train_end, block * (i + 1) if i < n_splits else n)

        model = make_model(random_state)
        model.fit(X.iloc[:train_end], y.iloc[:train_end])
        preds = model.predict(X.iloc[test_slice])

        chunk = pd.DataFrame(
            {
                "actual": y.iloc[test_slice].to_numpy(),
                "model": preds,
                "seasonal_naive": hourly["lag_24"].iloc[test_slice].to_numpy(),
            },
            index=hourly.index[test_slice],
        )
        rows.append(chunk)

    predictions = pd.concat(rows)
    mean_pred = np.full(len(predictions), y.iloc[: block].mean())

    return WalkForwardResult(
        n_splits=n_splits,
        model_metrics=regression_metrics(predictions["actual"], predictions["model"]),
        mean_baseline_metrics=regression_metrics(predictions["actual"], mean_pred),
        seasonal_naive_metrics=regression_metrics(
            predictions["actual"], predictions["seasonal_naive"]
        ),
        predictions=predictions,
    )


def forecast_horizon(model, hourly: pd.DataFrame, horizon: int = 24) -> list[dict]:
    """Recursively forecast the ``horizon`` hours after the end of ``hourly``.

    Each step predicts one hour, then feeds that prediction back in as ``lag_1`` (and
    into the rolling mean) for the next step. Future temperature is approximated by the
    historical mean for that hour of day. Returns a list of
    ``{timestamp, hour, predicted_energy_kwh}``.
    """
    history = hourly[TARGET].tolist()
    last_ts = hourly.index[-1]
    temp_by_hour = hourly.groupby("hour")["temperature_c"].mean()
    fallback_temp = float(hourly["temperature_c"].mean())

    out = []
    for step in range(1, horizon + 1):
        ts = last_ts + pd.Timedelta(hours=step)
        feat = {
            "hour": ts.hour,
            "weekday": ts.dayofweek,
            "is_weekend": int(ts.dayofweek >= 5),
            "month": ts.month,
            "temperature_c": float(temp_by_hour.get(ts.hour, fallback_temp)),
            "lag_1": history[-1],
            "lag_24": history[-24],
            "roll_24_mean": float(np.mean(history[-24:])),
        }
        pred = float(model.predict(pd.DataFrame([feat])[DEMAND_FEATURES])[0])
        history.append(pred)
        out.append({
            "timestamp": ts.isoformat(),
            "hour": int(ts.hour),
            "predicted_energy_kwh": round(pred, 2),
        })
    return out


def train(df: pd.DataFrame | None = None, persist: bool = True):
    """Build the hourly series, run walk-forward validation, refit on all of it, persist."""
    from evcharging.config import CLEAN_PARQUET
    from evcharging.models.common import save_artifact, write_metrics

    if df is None:
        df = pd.read_parquet(CLEAN_PARQUET)

    hourly = build_hourly_demand(df)
    result = walk_forward(hourly)

    final_model = make_model()
    final_model.fit(hourly[DEMAND_FEATURES], hourly[TARGET])

    if persist:
        save_artifact(
            {"model": final_model, "features": DEMAND_FEATURES},
            "demand_forecaster.joblib",
        )
        write_metrics("demand", result.metrics_payload())

    return result, hourly, final_model


if __name__ == "__main__":
    res, hourly, _ = train()
    m = res.model_metrics
    print(f"hourly series: {len(hourly)} points")
    print(f"model           MAE {m['mae']:.2f}  RMSE {m['rmse']:.2f}")
    print(f"mean baseline   MAE {res.mean_baseline_metrics['mae']:.2f}")
    print(f"seasonal-naive  MAE {res.seasonal_naive_metrics['mae']:.2f}")
