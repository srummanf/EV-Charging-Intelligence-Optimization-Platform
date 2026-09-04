"""Turn loaded charging sessions into model-ready features.

The pipeline is three independent steps, each a pure function that returns a new
DataFrame:

1. :func:`add_time_parts` - calendar features from the real ``start_time``.
2. :func:`add_consistency_features` - the physics-derived ratios that the anomaly model
   and several regressors rely on.
3. :func:`add_encodings` - one-hot for the nominal categoricals, an ordinal code for
   ``charger_type`` (which has a natural speed order).

:func:`build_features` runs all three. :func:`impute_predictors` is kept separate and is
*not* called by ``build_features``: the clean parquet keeps missing values as ``NaN`` so
each Phase-2 model can drop rows on its own target and impute predictors its own way.

Every derived ratio is defined so that **1.0 means the two quantities agree**. Values far
from 1.0, or that are negative, indicate an internally inconsistent session.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from evcharging.config import CHARGER_TYPE_ORDER

# Categoricals expanded with one-hot encoding. ``charger_type`` is handled separately.
ONE_HOT_COLS = ["vehicle_model", "location", "user_type"]


def add_time_parts(df: pd.DataFrame) -> pd.DataFrame:
    """Add calendar features derived from ``start_time``.

    The raw ``Time of Day`` and ``Day of Week`` columns (kept as
    ``*_reported``) do not match the timestamps, so we derive our own:

    - ``hour`` - 0-23, hour the session started (start times are always on the hour).
    - ``weekday`` - 0 (Monday) to 6 (Sunday).
    - ``day_name`` - e.g. ``"Monday"``, for readable plots.
    - ``month`` - 1 or 2 (the data spans Jan-Feb 2024).
    - ``is_weekend`` - 1 if Saturday or Sunday, else 0.
    """
    out = df.copy()
    start = out["start_time"].dt

    out["hour"] = start.hour
    out["weekday"] = start.dayofweek
    out["day_name"] = start.day_name()
    out["month"] = start.month
    out["is_weekend"] = (out["weekday"] >= 5).astype(int)
    return out


def add_consistency_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add SOC / energy / power derived quantities and their consistency ratios.

    New columns:

    - ``soc_delta_pct`` - percentage points added to the battery this session.
    - ``implied_power_kw`` - ``energy_kwh / duration_hours``: the average power the
      energy and our timestamp duration imply.
    - ``soc_implied_energy_kwh`` - ``soc_delta_pct/100 * battery_capacity_kwh``: the
      energy the SOC swing implies.
    - ``energy_per_km`` - ``energy_kwh / distance_km``.
    - ``power_consistency_ratio`` - ``(charging_rate_kw * duration_hours) / energy_kwh``.
      1.0 means the nameplate rate, the duration and the delivered energy agree.
    - ``soc_energy_consistency_ratio`` - ``soc_implied_energy_kwh / energy_kwh``. 1.0
      means the SOC swing and the delivered energy agree.
    - ``duration_consistency_ratio`` - ``duration_hours_reported / duration_hours``. 1.0
      means the reported duration matches end - start.

    Division by zero or by a missing value yields ``NaN`` (not ``inf``); callers treat
    that as "cannot assess".
    """
    out = df.copy()

    out["soc_delta_pct"] = out["soc_end_pct"] - out["soc_start_pct"]
    out["soc_implied_energy_kwh"] = out["soc_delta_pct"] / 100.0 * out["battery_capacity_kwh"]

    with np.errstate(divide="ignore", invalid="ignore"):
        out["implied_power_kw"] = out["energy_kwh"] / out["duration_hours"]
        out["energy_per_km"] = out["energy_kwh"] / out["distance_km"]
        out["power_consistency_ratio"] = (out["charging_rate_kw"] * out["duration_hours"]) / out[
            "energy_kwh"
        ]
        out["soc_energy_consistency_ratio"] = out["soc_implied_energy_kwh"] / out["energy_kwh"]
        out["duration_consistency_ratio"] = out["duration_hours_reported"] / out["duration_hours"]

    ratio_cols = [
        "implied_power_kw",
        "energy_per_km",
        "power_consistency_ratio",
        "soc_energy_consistency_ratio",
        "duration_consistency_ratio",
    ]
    out[ratio_cols] = out[ratio_cols].replace([np.inf, -np.inf], np.nan)
    return out


def add_encodings(df: pd.DataFrame) -> pd.DataFrame:
    """One-hot encode the nominal categoricals and ordinal-encode ``charger_type``.

    - ``vehicle_model``, ``location``, ``user_type`` -> ``<col>_<value>`` indicator
      columns (all categories kept; no ``drop_first`` so the columns stay
      self-explanatory for tree models and dashboards).
    - ``charger_type`` -> ``charger_type_code`` using the physical speed order in
      :data:`evcharging.config.CHARGER_TYPE_ORDER` (Level 1 = 0, Level 2 = 1,
      DC Fast Charger = 2). Unknown values become ``NaN``.

    The original string columns are kept alongside the encodings.
    """
    out = df.copy()

    dummies = pd.get_dummies(out[ONE_HOT_COLS], prefix=ONE_HOT_COLS, prefix_sep="_", dtype=int)
    out = pd.concat([out, dummies], axis=1)

    code_map = {name: i for i, name in enumerate(CHARGER_TYPE_ORDER)}
    out["charger_type_code"] = out["charger_type"].map(code_map).astype("Int64")
    return out


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Run :func:`add_time_parts`, :func:`add_consistency_features` and
    :func:`add_encodings` in sequence and return the result.

    Missing values are left as ``NaN``. Row count and order are unchanged.
    """
    out = add_time_parts(df)
    out = add_consistency_features(out)
    out = add_encodings(out)
    return out


def impute_predictors(
    df: pd.DataFrame,
    numeric_cols: list[str],
    categorical_cols: list[str] | None = None,
) -> pd.DataFrame:
    """Fill missing predictor values: numeric -> column median, categorical -> ``"unknown"``.

    This is for the Phase-2 model-prep step, applied *after* rows with a missing target
    have been dropped, so the medians are computed on the modelling subset. It is
    deliberately not part of :func:`build_features`.

    Args:
        df: The feature frame (already row-filtered on the model's target).
        numeric_cols: Numeric predictor columns to median-fill.
        categorical_cols: Categorical predictor columns to fill with ``"unknown"``.

    Returns:
        A copy of ``df`` with those columns filled.
    """
    out = df.copy()
    for col in numeric_cols:
        out[col] = out[col].fillna(out[col].median())
    for col in categorical_cols or []:
        out[col] = out[col].astype("object").fillna("unknown")
    return out
