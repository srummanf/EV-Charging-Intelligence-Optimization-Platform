"""EV Charging Intelligence & Optimization Platform.

Reusable building blocks shared by the notebooks, the training scripts, and the API:

- ``evcharging.data``            loading and validation of raw charging sessions
- ``evcharging.features``        feature engineering
- ``evcharging.models``          energy/duration regressors, segmentation, anomaly,
                                 demand forecasting (Phase 2)
- ``evcharging.recommendation``  the charging recommendation engine (Phase 3)
- ``evcharging.analytics``       dashboard aggregations (Phase 4)
"""

__version__ = "0.1.0"
