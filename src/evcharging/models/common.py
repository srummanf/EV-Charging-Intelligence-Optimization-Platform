"""Shared helpers for the Phase 2 models.

Three things every model needs, in one place so they stay consistent:

1. **Regression metrics** - MAE, RMSE and R2 from one function, so "the score" means the
   same thing in every notebook and in ``metrics.json``.
2. **K-fold evaluation** - an explicit ``KFold`` loop (not ``cross_val_score``) that
   returns the per-fold numbers as well as the mean and standard deviation, so a reader
   can see fold-to-fold stability.
3. **Artifact and metrics IO** - ``save_artifact`` / ``load_artifact`` wrap ``joblib``;
   ``write_metrics`` does a read-modify-write of the shared ``models/metrics.json``.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold

from evcharging.config import METRICS_JSON, MODELS_DIR, RANDOM_STATE


def regression_metrics(y_true, y_pred) -> dict[str, float]:
    """Return ``{"mae", "rmse", "r2"}`` for a set of predictions.

    - **MAE** (mean absolute error) - average size of the miss, in the target's units.
      Robust to outliers.
    - **RMSE** (root mean squared error) - like MAE but squares the errors first, so a
      few large misses dominate. Always ``>= MAE``.
    - **R2** (coefficient of determination) - the fraction of the target's variance the
      model explains. ``1.0`` is perfect, ``0.0`` is no better than predicting the mean,
      negative is worse than the mean.
    """
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "r2": float(r2_score(y_true, y_pred)),
    }


@dataclass
class RegressionReport:
    """The result of evaluating one model with :func:`kfold_regression`."""

    name: str
    n_splits: int
    fold_metrics: list[dict[str, float]]
    mean: dict[str, float] = field(default_factory=dict)
    std: dict[str, float] = field(default_factory=dict)

    def __post_init__(self) -> None:
        keys = self.fold_metrics[0].keys()
        self.mean = {k: float(np.mean([m[k] for m in self.fold_metrics])) for k in keys}
        self.std = {k: float(np.std([m[k] for m in self.fold_metrics])) for k in keys}

    def as_dict(self) -> dict:
        return {
            "name": self.name,
            "cv_folds": self.n_splits,
            "mae": round(self.mean["mae"], 4),
            "rmse": round(self.mean["rmse"], 4),
            "r2": round(self.mean["r2"], 4),
            "mae_std": round(self.std["mae"], 4),
            "rmse_std": round(self.std["rmse"], 4),
            "r2_std": round(self.std["r2"], 4),
        }

    def summary_row(self) -> str:
        return (
            f"{self.name:<22} "
            f"MAE {self.mean['mae']:7.3f} +/- {self.std['mae']:.3f}   "
            f"RMSE {self.mean['rmse']:7.3f}   "
            f"R2 {self.mean['r2']:6.3f}"
        )


def kfold_regression(
    name: str,
    make_estimator: Callable[[], BaseEstimator],
    X: pd.DataFrame,
    y: pd.Series,
    n_splits: int = 5,
    random_state: int = RANDOM_STATE,
) -> RegressionReport:
    """Evaluate a regressor with an explicit K-fold loop.

    A fresh estimator is built from ``make_estimator`` for every fold, trained on the
    training part and scored on the held-out part. Returns a :class:`RegressionReport`
    carrying every fold's metrics plus their mean and standard deviation.

    Args:
        name: Label for the model (used in reports and ``metrics.json``).
        make_estimator: Zero-argument callable returning an unfitted estimator or
            pipeline. A callable, not an instance, so folds cannot share fitted state.
        X: Predictor frame.
        y: Target series, aligned to ``X``.
        n_splits: Number of folds.
        random_state: Seed for the fold shuffle.
    """
    kf = KFold(n_splits=n_splits, shuffle=True, random_state=random_state)
    X = X.reset_index(drop=True)
    y = y.reset_index(drop=True)

    fold_metrics: list[dict[str, float]] = []
    for train_idx, test_idx in kf.split(X):
        model = make_estimator()
        model.fit(X.iloc[train_idx], y.iloc[train_idx])
        preds = model.predict(X.iloc[test_idx])
        fold_metrics.append(regression_metrics(y.iloc[test_idx], preds))

    return RegressionReport(name=name, n_splits=n_splits, fold_metrics=fold_metrics)


def save_artifact(obj, name: str, models_dir: Path = MODELS_DIR) -> Path:
    """Persist ``obj`` to ``models_dir/<name>`` with joblib. Returns the path."""
    models_dir.mkdir(parents=True, exist_ok=True)
    path = models_dir / name
    joblib.dump(obj, path)
    return path


def load_artifact(name: str, models_dir: Path = MODELS_DIR):
    """Load an artifact saved by :func:`save_artifact`."""
    return joblib.load(models_dir / name)


def write_metrics(key: str, payload: dict, path: Path = METRICS_JSON) -> dict:
    """Merge ``{key: payload}`` into the JSON file at ``path`` and write it back.

    The file is one object keyed by task (``"energy"``, ``"duration"``, ...). Existing
    keys are replaced, others are left alone, so each training script can update its own
    section without clobbering the rest.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    current = {}
    if path.exists():
        current = json.loads(path.read_text(encoding="utf-8"))
    current[key] = payload
    path.write_text(json.dumps(current, indent=2), encoding="utf-8")
    return current
