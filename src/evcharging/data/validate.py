"""Domain-rule validation for EV charging sessions.

This dataset was generated column by column with almost no cross-column consistency, so
instead of trying to repair it we *measure* it. Every rule below turns into:

- a per-row boolean column named ``flag_<rule>`` added to the DataFrame, and
- an entry in ``validation_report.json`` with the count and percentage of rows it hits.

A ``True`` flag means "this row violates the rule". ``flag_any`` is the row-wise OR of
all rules. Rows are never dropped here; downstream code decides what to do with a flag.

The physics behind the rules:

- Energy delivered to a battery cannot exceed the battery's capacity.
- State of charge should *increase* over a charging session and stay within 0-100 %.
- ``Charging Rate (kW) x Duration (h)`` should roughly equal ``Energy Consumed (kWh)``.
- The energy implied by the SOC swing, ``(SOC_end - SOC_start)/100 x capacity``, should
  roughly equal the measured energy.
- Reported ``Charging Duration`` should match ``End - Start``.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from evcharging.config import (
    BATTERY_CAPACITY_MAX_KWH,
    BATTERY_CAPACITY_MIN_KWH,
    COLS_WITH_MISSING,
    DURATION_MISMATCH_TOL_HOURS,
    POWER_MISMATCH_REL_TOL,
    SOC_MAX_PCT,
    SOC_MIN_PCT,
    TEMPERATURE_MAX_C,
    TEMPERATURE_MIN_C,
    VALIDATION_REPORT,
)

# Order matters only for readability of the report.
FLAG_COLUMNS = [
    "flag_energy_exceeds_capacity",
    "flag_soc_not_increasing",
    "flag_soc_out_of_range",
    "flag_duration_mismatch",
    "flag_power_mismatch",
    "flag_soc_energy_mismatch",
    "flag_battery_capacity_out_of_range",
    "flag_temperature_out_of_range",
    "flag_missing_values",
]

# One-line human descriptions, reused in the report and the notebook.
FLAG_DESCRIPTIONS: dict[str, str] = {
    "flag_energy_exceeds_capacity": "Energy consumed exceeds the vehicle's battery capacity.",
    "flag_soc_not_increasing": "State of charge did not increase during the session.",
    "flag_soc_out_of_range": "A state-of-charge reading falls outside 0-100 %.",
    "flag_duration_mismatch": (
        f"Reported duration differs from (end - start) by more than "
        f"{DURATION_MISMATCH_TOL_HOURS} h."
    ),
    "flag_power_mismatch": (
        f"|rate x duration - energy| / energy exceeds {POWER_MISMATCH_REL_TOL:.0%}."
    ),
    "flag_soc_energy_mismatch": (
        f"|SOC-implied energy - measured energy| / energy exceeds {POWER_MISMATCH_REL_TOL:.0%}."
    ),
    "flag_battery_capacity_out_of_range": (
        f"Battery capacity outside {BATTERY_CAPACITY_MIN_KWH}-{BATTERY_CAPACITY_MAX_KWH} kWh."
    ),
    "flag_temperature_out_of_range": (
        f"Temperature outside {TEMPERATURE_MIN_C} to {TEMPERATURE_MAX_C} C."
    ),
    "flag_missing_values": ("At least one of " + ", ".join(COLS_WITH_MISSING) + " is missing."),
}


def _rel_gap(a: pd.Series, b: pd.Series) -> pd.Series:
    """Return ``|a - b| / |b|``, leaving ``NaN`` where either input is missing.

    Used for the two "these two quantities should agree" rules. A ``NaN`` result means
    the rule could not be evaluated (usually a missing value), and downstream those
    become a non-violation so a row is not double-counted with ``flag_missing_values``.
    """
    with np.errstate(divide="ignore", invalid="ignore"):
        return (a - b).abs() / b.abs()


def add_validation_flags(df: pd.DataFrame) -> pd.DataFrame:
    """Add the ``flag_*`` boolean columns to a copy of ``df``.

    Expects the canonical column names produced by
    :func:`evcharging.data.load.load_raw`, including the computed ``duration_hours``.

    Args:
        df: A loaded sessions DataFrame.

    Returns:
        A copy of ``df`` with the columns in :data:`FLAG_COLUMNS` appended, plus
        ``flag_any``. Every flag column is a plain ``bool`` dtype with no missing values:
        a rule that cannot be evaluated for a row (e.g. missing energy) yields ``False``.
    """
    out = df.copy()

    soc_delta = out["soc_end_pct"] - out["soc_start_pct"]
    soc_implied_energy = soc_delta / 100.0 * out["battery_capacity_kwh"]
    rate_implied_energy = out["charging_rate_kw"] * out["duration_hours"]
    duration_gap = (out["duration_hours_reported"] - out["duration_hours"]).abs()

    flags = {
        "flag_energy_exceeds_capacity": out["energy_kwh"] > out["battery_capacity_kwh"],
        "flag_soc_not_increasing": soc_delta <= 0,
        "flag_soc_out_of_range": (
            (out["soc_start_pct"] < SOC_MIN_PCT)
            | (out["soc_start_pct"] > SOC_MAX_PCT)
            | (out["soc_end_pct"] < SOC_MIN_PCT)
            | (out["soc_end_pct"] > SOC_MAX_PCT)
        ),
        "flag_duration_mismatch": duration_gap > DURATION_MISMATCH_TOL_HOURS,
        "flag_power_mismatch": (
            _rel_gap(rate_implied_energy, out["energy_kwh"]) > POWER_MISMATCH_REL_TOL
        ),
        "flag_soc_energy_mismatch": (
            _rel_gap(soc_implied_energy, out["energy_kwh"]) > POWER_MISMATCH_REL_TOL
        ),
        "flag_battery_capacity_out_of_range": (
            (out["battery_capacity_kwh"] < BATTERY_CAPACITY_MIN_KWH)
            | (out["battery_capacity_kwh"] > BATTERY_CAPACITY_MAX_KWH)
        ),
        "flag_temperature_out_of_range": (
            (out["temperature_c"] < TEMPERATURE_MIN_C) | (out["temperature_c"] > TEMPERATURE_MAX_C)
        ),
        "flag_missing_values": out[COLS_WITH_MISSING].isna().any(axis=1),
    }

    for name in FLAG_COLUMNS:
        out[name] = flags[name].fillna(False).astype(bool)

    out["flag_any"] = out[FLAG_COLUMNS].any(axis=1)
    return out


def build_validation_report(df: pd.DataFrame) -> dict:
    """Summarise the validation flags into a JSON-serialisable dict.

    ``df`` may be passed with or without the flag columns already added; if they are
    missing they are computed here.

    Returns:
        A dict with ``n_rows``, ``n_rows_flagged``, a ``rules`` map (each rule ->
        ``{description, count, pct}``), and a ``missing_values`` map (column ->
        ``{count, pct}``).
    """
    if "flag_any" not in df.columns:
        df = add_validation_flags(df)

    n_rows = len(df)
    rules = {
        name: {
            "description": FLAG_DESCRIPTIONS[name],
            "count": int(df[name].sum()),
            "pct": round(float(df[name].mean() * 100), 2),
        }
        for name in FLAG_COLUMNS
    }
    missing = {
        col: {
            "count": int(df[col].isna().sum()),
            "pct": round(float(df[col].isna().mean() * 100), 2),
        }
        for col in COLS_WITH_MISSING
    }
    return {
        "n_rows": n_rows,
        "n_rows_flagged": int(df["flag_any"].sum()),
        "pct_rows_flagged": round(float(df["flag_any"].mean() * 100), 2),
        "rules": rules,
        "missing_values": missing,
    }


def write_validation_report(df: pd.DataFrame, path: str | Path = VALIDATION_REPORT) -> dict:
    """Build the report and write it to ``path`` as pretty-printed JSON. Returns it too."""
    report = build_validation_report(df)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report
