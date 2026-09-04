"""Load the raw EV charging CSV into a clean, typed DataFrame.

This module owns the *production* loading path. The EDA notebook repeats the same steps
cell by cell so a reader can see them; anything downstream (training scripts, the API,
tests) calls :func:`load_raw` and trusts the result.

The raw file has three quirks this module fixes:

1. The ``Temperature (\xb0C)`` header contains a raw Latin-1 ``0xB0`` byte, so the exact
   string is fragile. We match the column by its ``Temperature`` prefix instead.
2. The two timestamp columns are stored as strings.
3. ``Charging Duration (hours)`` disagrees with ``End - Start`` by ~1.2 h on average, so
   we keep the reported value under a ``_reported`` name and compute our own
   ``duration_hours`` from the timestamps.

Nothing here drops rows or imputes values. Validation flags come from
:mod:`evcharging.data.validate`; missing-value handling is deferred to the per-model
feature prep so each model can make its own choice.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from evcharging.config import (
    COLUMN_RENAMES,
    NUMERIC_COLS,
    RAW_CSV,
    TEMPERATURE_COL,
    TEMPERATURE_RAW_PREFIX,
    TIMESTAMP_COLS,
)


def _rename_temperature_column(df: pd.DataFrame) -> pd.DataFrame:
    """Rename whatever column starts with ``Temperature`` to ``temperature_c``.

    The raw header is ``Temperature (\xb0C)`` where ``\xb0`` is a single Latin-1 byte.
    Depending on the reader's encoding that byte surfaces as ``\xb0``, ``�`` or a
    mojibake pair, so matching the literal string is unreliable. The prefix is stable.
    """
    matches = [c for c in df.columns if c.startswith(TEMPERATURE_RAW_PREFIX)]
    if len(matches) != 1:
        raise ValueError(
            f"expected exactly one column starting with {TEMPERATURE_RAW_PREFIX!r}, "
            f"found {matches!r}"
        )
    return df.rename(columns={matches[0]: TEMPERATURE_COL})


def load_raw(path: str | Path = RAW_CSV) -> pd.DataFrame:
    """Read the raw CSV and return a clean, typed DataFrame.

    Steps, in order:

    1. Read the CSV.
    2. Rename the long headers to short snake_case names (see
       :data:`evcharging.config.COLUMN_RENAMES`), including the fragile temperature
       header.
    3. Parse ``start_time`` and ``end_time`` to ``datetime64[ns]``.
    4. Coerce the numeric columns to ``float`` (non-numeric junk becomes ``NaN``).
    5. Add ``duration_hours`` = ``(end_time - start_time)`` in hours, the value the rest
       of the project treats as the true session length.

    Args:
        path: Location of the raw CSV. Defaults to
            :data:`evcharging.config.RAW_CSV`.

    Returns:
        A DataFrame with 1,320 rows and canonical column names. Row order is preserved;
        no rows are dropped and no values are imputed.
    """
    df = pd.read_csv(path)
    df = df.rename(columns=COLUMN_RENAMES)
    df = _rename_temperature_column(df)

    for col in TIMESTAMP_COLS:
        df[col] = pd.to_datetime(df[col])

    for col in NUMERIC_COLS:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df["duration_hours"] = (df["end_time"] - df["start_time"]).dt.total_seconds() / 3600.0

    return df
