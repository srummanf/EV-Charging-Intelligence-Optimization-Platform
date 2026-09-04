"""Project-wide constants: paths, column names, and validation thresholds.

Keeping these in one place means the notebooks, the scripts, and the tests all agree on
where files live and what counts as an out-of-range value.
"""

from __future__ import annotations

from pathlib import Path

# --------------------------------------------------------------------------------------
# Paths
# --------------------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[2]

DATA_DIR = PROJECT_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
MODELS_DIR = PROJECT_ROOT / "models"

RAW_CSV = RAW_DIR / "ev_charging_patterns.csv"
CLEAN_PARQUET = PROCESSED_DIR / "sessions_clean.parquet"
VALIDATION_REPORT = PROCESSED_DIR / "validation_report.json"

# Precomputed dashboard payload: KPIs, time/location/segment breakdowns and an anomaly
# summary, written by ``scripts/build_analytics.py`` and served read-only by the API.
ANALYTICS_JSON = PROCESSED_DIR / "analytics.json"

# Phase 2 model artifacts. Every trained model is a joblib file here; metrics.json is the
# single machine-readable scoreboard the README and the API both read.
METRICS_JSON = MODELS_DIR / "metrics.json"

RANDOM_STATE = 42

# --------------------------------------------------------------------------------------
# Column names
#
# The raw file uses long human-readable headers. We rename to short snake_case names for
# code ergonomics. Two of the raw columns ("Time of Day", "Day of Week") do not match the
# timestamps, so they are renamed with a ``_reported`` suffix to keep them distinct from
# the values we derive ourselves in feature engineering.
# --------------------------------------------------------------------------------------
COLUMN_RENAMES: dict[str, str] = {
    "User ID": "user_id",
    "Vehicle Model": "vehicle_model",
    "Battery Capacity (kWh)": "battery_capacity_kwh",
    "Charging Station ID": "station_id",
    "Charging Station Location": "location",
    "Charging Start Time": "start_time",
    "Charging End Time": "end_time",
    "Energy Consumed (kWh)": "energy_kwh",
    "Charging Duration (hours)": "duration_hours_reported",
    "Charging Rate (kW)": "charging_rate_kw",
    "Charging Cost (USD)": "cost_usd",
    "Time of Day": "time_of_day_reported",
    "Day of Week": "day_of_week_reported",
    "State of Charge (Start %)": "soc_start_pct",
    "State of Charge (End %)": "soc_end_pct",
    "Distance Driven (since last charge) (km)": "distance_km",
    "Vehicle Age (years)": "vehicle_age_years",
    "Charger Type": "charger_type",
    "User Type": "user_type",
    # "Temperature (°C)" is handled separately in load.py because the degree sign is a
    # raw 0xB0 byte and the exact header string is fragile.
}

TEMPERATURE_RAW_PREFIX = "Temperature"
TEMPERATURE_COL = "temperature_c"

TIMESTAMP_COLS = ["start_time", "end_time"]

NUMERIC_COLS = [
    "battery_capacity_kwh",
    "energy_kwh",
    "duration_hours_reported",
    "charging_rate_kw",
    "cost_usd",
    "soc_start_pct",
    "soc_end_pct",
    "distance_km",
    "temperature_c",
    "vehicle_age_years",
]

CATEGORICAL_COLS = ["vehicle_model", "location", "charger_type", "user_type"]

# Columns that carry missing values in the raw file.
COLS_WITH_MISSING = ["energy_kwh", "charging_rate_kw", "distance_km"]

# Charger types in physical speed order (used for ordinal encoding).
CHARGER_TYPE_ORDER = ["Level 1", "Level 2", "DC Fast Charger"]

# --------------------------------------------------------------------------------------
# Validation thresholds
# --------------------------------------------------------------------------------------
# Reported duration is allowed to differ from (end - start) by this many hours before we
# flag it.
DURATION_MISMATCH_TOL_HOURS = 0.5

# |rate * duration - energy| / energy above this fraction is flagged as inconsistent.
POWER_MISMATCH_REL_TOL = 0.5

# Plausible physical ranges. Values outside these are flagged, not dropped.
SOC_MIN_PCT, SOC_MAX_PCT = 0.0, 100.0
BATTERY_CAPACITY_MIN_KWH, BATTERY_CAPACITY_MAX_KWH = 10.0, 150.0
TEMPERATURE_MIN_C, TEMPERATURE_MAX_C = -30.0, 60.0

# Nominal battery capacity per model, used only as reference context in the EDA notebook.
NOMINAL_BATTERY_KWH: dict[str, float] = {
    "Tesla Model 3": 60.0,
    "Hyundai Kona": 64.0,
    "Nissan Leaf": 40.0,
    "BMW i3": 42.0,
    "Chevy Bolt": 65.0,
}
