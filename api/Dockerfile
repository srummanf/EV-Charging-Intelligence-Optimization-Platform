# EV Charging Platform API — build from the repo root:
#   docker build -f api/Dockerfile -t evcharging-api .
#   docker run -p 8000:8000 evcharging-api
#
# The image is self-contained: it regenerates the processed dataset, trains all five
# models and builds the analytics payload at build time, so no volumes are required.

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install the package and its API extra. Dependencies are declared in pyproject.toml
# (pandas, numpy, pyarrow, scikit-learn, xgboost, joblib) plus [api] (fastapi, uvicorn).
COPY pyproject.toml README.md ./
COPY src/ ./src/
RUN pip install --upgrade pip && pip install ".[api]"

# Bring in the rest and generate the artifacts the API loads at startup.
COPY data/ ./data/
COPY scripts/ ./scripts/
COPY api/ ./api/
RUN python scripts/prepare_data.py \
    && python scripts/train_all.py \
    && python scripts/build_analytics.py

EXPOSE 8000

# A single Fluid/uvicorn worker is plenty for this read-mostly service; scale with
# replicas rather than threads so each holds its own copy of the models.
CMD ["uvicorn", "api.app:app", "--host", "0.0.0.0", "--port", "8000"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').status==200 else 1)"
