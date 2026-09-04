"""Shared fixtures for the test suite."""

from __future__ import annotations

import pandas as pd
import pytest

from evcharging.data import load_raw


@pytest.fixture(scope="session")
def raw_df() -> pd.DataFrame:
    """The raw CSV loaded through the production path, loaded once per test session."""
    return load_raw()
