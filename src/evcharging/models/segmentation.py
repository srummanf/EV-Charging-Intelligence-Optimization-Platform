"""Session segmentation - group charging sessions into behavioural archetypes.

Module D of the platform, reframed for this dataset. The original brief aggregated by
user, but there is exactly one session per user, so there is nothing to aggregate.
Instead we cluster the **sessions** themselves on a handful of interpretable behavioural
features and describe the resulting groups.

> **K-Means clustering**
>
> K-Means partitions rows into ``k`` groups by repeatedly (1) assigning each row to the
> nearest group centre and (2) moving each centre to the mean of its members, until the
> assignment stops changing. It needs the feature scale to be comparable, so a
> ``StandardScaler`` always comes first.

Pipeline: feature subset -> ``StandardScaler`` -> ``KMeans``. ``k`` is chosen with the
elbow of the inertia curve and the silhouette score. Because the EDA showed the sessions
form one diffuse cloud, the clusters are expected to be soft slices of a continuum rather
than well-separated types; the silhouette score will be low and that is reported plainly.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from evcharging.config import RANDOM_STATE
from evcharging.features import impute_predictors

# Interpretable, behaviour-describing features. Deliberately not the one-hot vehicle /
# location columns - we want archetypes of *how* a session runs, not *who* ran it.
CLUSTER_FEATURES = [
    "energy_kwh",
    "duration_hours",
    "distance_km",
    "soc_delta_pct",
    "charging_rate_kw",
    "cost_usd",
]


def prepare_matrix(df: pd.DataFrame) -> pd.DataFrame:
    """Return the clustering feature matrix: :data:`CLUSTER_FEATURES`, median-imputed.

    About 190 rows miss at least one of ``energy_kwh`` / ``charging_rate_kw`` /
    ``distance_km``; they are median-imputed rather than dropped so every session ends up
    with a cluster label for the dashboard. The imputation is noted as a caveat in the
    notebook.
    """
    X = df[CLUSTER_FEATURES].copy()
    X = impute_predictors(X, numeric_cols=CLUSTER_FEATURES)
    return X.astype(float)


def make_pipeline(k: int, random_state: int = RANDOM_STATE) -> Pipeline:
    """A ``StandardScaler`` -> ``KMeans(k)`` pipeline with a fixed seed and ``n_init=10``."""
    return Pipeline(
        [
            ("scale", StandardScaler()),
            ("kmeans", KMeans(n_clusters=k, n_init=10, random_state=random_state)),
        ]
    )


@dataclass
class KSearchResult:
    ks: list[int]
    inertia: list[float]
    silhouette: list[float]

    def as_frame(self) -> pd.DataFrame:
        return pd.DataFrame(
            {"k": self.ks, "inertia": self.inertia, "silhouette": self.silhouette}
        ).set_index("k")


def search_k(
    X: pd.DataFrame,
    k_values: range | list[int] = range(2, 9),
    random_state: int = RANDOM_STATE,
) -> KSearchResult:
    """Fit K-Means for each ``k`` and record inertia and mean silhouette.

    - **Inertia** is the total squared distance from each point to its cluster centre;
      it always falls as ``k`` rises, so we look for the "elbow" where the fall slows.
    - **Silhouette** (range -1 to 1) compares how close each point is to its own cluster
      versus the nearest other cluster; higher is better-separated.
    """
    ks, inertia, silhouette = [], [], []
    scaler = StandardScaler().fit(X)
    Xs = scaler.transform(X)
    for k in k_values:
        km = KMeans(n_clusters=k, n_init=10, random_state=random_state).fit(Xs)
        ks.append(k)
        inertia.append(float(km.inertia_))
        silhouette.append(float(silhouette_score(Xs, km.labels_)))
    return KSearchResult(ks=ks, inertia=inertia, silhouette=silhouette)


def choose_k(search: KSearchResult, flat_tol: float = 0.03, default_k: int = 4) -> int:
    """Pick ``k`` from a :class:`KSearchResult`.

    If the silhouette barely moves across the range (``max - min < flat_tol``), there is
    no natural number of clusters, so we fall back to ``default_k`` - a small, readable
    number of archetypes. Otherwise we take the silhouette-maximising ``k``.
    """
    frame = search.as_frame()["silhouette"]
    if frame.max() - frame.min() < flat_tol:
        return default_k
    return int(frame.idxmax())


def cluster_profile(df: pd.DataFrame, labels: np.ndarray) -> pd.DataFrame:
    """Mean of each clustering feature per cluster, plus the cluster size.

    The row for each cluster is what its sessions look like on average - the basis for
    naming the archetype.
    """
    profile = df[CLUSTER_FEATURES].copy()
    profile["cluster"] = labels
    summary = profile.groupby("cluster").mean()
    summary.insert(0, "n_sessions", profile.groupby("cluster").size())
    return summary


def name_archetypes(profile: pd.DataFrame) -> dict[int, str]:
    """Turn each cluster's profile into a short human-readable name.

    The name is built from where the cluster sits relative to the others on the two
    features that matter most for a charging session - delivered energy and duration -
    with charging rate as a tie-breaker descriptor. Names are derived here, not
    hard-coded, so they follow the data if it changes.
    """
    energy_rank = profile["energy_kwh"].rank()
    duration_rank = profile["duration_hours"].rank()
    n = len(profile)

    names: dict[int, str] = {}
    for cluster in profile.index:
        e, d = energy_rank[cluster], duration_rank[cluster]
        energy_word = "high-energy" if e > n / 2 else "low-energy"
        pace_word = "long" if d > n / 2 else "short"
        rate = profile.loc[cluster, "charging_rate_kw"]
        speed_word = "fast" if rate >= profile["charging_rate_kw"].median() else "slow"
        names[cluster] = f"{pace_word.capitalize()} {speed_word} {energy_word} sessions"
    return names


@dataclass
class SegmentationResult:
    k: int
    pipeline: Pipeline
    labels: np.ndarray
    profile: pd.DataFrame
    archetypes: dict[int, str]
    silhouette: float

    def metrics_payload(self) -> dict:
        return {
            "k": self.k,
            "n_sessions": int(len(self.labels)),
            "silhouette": round(self.silhouette, 4),
            "features": CLUSTER_FEATURES,
            "archetypes": {str(c): name for c, name in self.archetypes.items()},
            "cluster_sizes": {
                str(c): int(n) for c, n in self.profile["n_sessions"].items()
            },
        }


def fit_segmentation(
    df: pd.DataFrame, k: int, random_state: int = RANDOM_STATE
) -> SegmentationResult:
    """Fit the scaler+K-Means pipeline for a chosen ``k`` and describe the clusters."""
    X = prepare_matrix(df)
    pipeline = make_pipeline(k, random_state=random_state)
    labels = pipeline.fit_predict(X)
    Xs = pipeline.named_steps["scale"].transform(X)
    profile = cluster_profile(df, labels)
    return SegmentationResult(
        k=k,
        pipeline=pipeline,
        labels=labels,
        profile=profile,
        archetypes=name_archetypes(profile),
        silhouette=float(silhouette_score(Xs, labels)),
    )


def train(df: pd.DataFrame | None = None, k: int | None = None, persist: bool = True):
    """Search ``k`` (2..8), pick the best by silhouette, fit, and optionally persist.

    Args:
        df: Processed sessions frame. Loaded from ``sessions_clean.parquet`` if omitted.
        k: Force a specific ``k`` instead of the silhouette-argmax.
        persist: Write ``session_segmenter.joblib`` (+ label lookup) and update
            ``metrics.json``.
    """
    from evcharging.config import CLEAN_PARQUET
    from evcharging.models.common import save_artifact, write_metrics

    if df is None:
        df = pd.read_parquet(CLEAN_PARQUET)

    X = prepare_matrix(df)
    search = search_k(X)
    if k is None:
        k = choose_k(search)

    result = fit_segmentation(df, k)

    if persist:
        save_artifact(
            {"pipeline": result.pipeline, "archetypes": result.archetypes},
            "session_segmenter.joblib",
        )
        payload = result.metrics_payload()
        payload["k_search"] = search.as_frame().round(4).reset_index().to_dict("list")
        write_metrics("segmentation", payload)

    return result, search


if __name__ == "__main__":
    res, search = train()
    print(search.as_frame().round(3))
    print(f"\nchosen k = {res.k}, silhouette = {res.silhouette:.3f}")
    for cluster, name in res.archetypes.items():
        print(f"  cluster {cluster}: {name}  (n={res.profile.loc[cluster, 'n_sessions']})")
