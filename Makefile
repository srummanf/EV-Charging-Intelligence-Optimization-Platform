# EV Charging Intelligence & Optimization Platform — common tasks.
# Requires a Python venv on PATH (see `make setup`) and Node for the `web-*` targets.

PYTHON ?= python
NPM ?= npm

.DEFAULT_GOAL := help
.PHONY: help setup data train analytics pipeline api web test lint fmt \
        docker-build docker-up clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

setup: ## Create a venv and install the package with dev + api + viz extras
	$(PYTHON) -m venv .venv
	. .venv/bin/activate && pip install --upgrade pip && pip install -e ".[dev,api,viz]"

data: ## Build data/processed/sessions_clean.parquet + validation_report.json
	$(PYTHON) scripts/prepare_data.py

train: ## Train all five models -> models/ (also refreshes analytics.json)
	$(PYTHON) scripts/train_all.py

analytics: ## Rebuild data/processed/analytics.json only
	$(PYTHON) scripts/build_analytics.py

pipeline: data train ## Run the whole offline pipeline from raw CSV to artifacts

api: ## Run the FastAPI service on :8000
	uvicorn api.app:app --reload

web: ## Run the Next.js dashboard on :3000 (needs the API running)
	cd web && $(NPM) run dev

test: ## Run the pytest suite (core + API)
	$(PYTHON) -m pytest -q

lint: ## ruff check + web eslint
	$(PYTHON) -m ruff check .
	cd web && $(NPM) run lint

fmt: ## ruff format the Python code
	$(PYTHON) -m ruff format .

docker-build: ## Build both container images
	docker compose build

docker-up: ## Start api + web with docker compose
	docker compose up

clean: ## Remove generated artifacts and caches
	rm -rf data/processed/*.parquet data/processed/*.json models/*.joblib models/*.png \
		models/metrics.json .pytest_cache .ruff_cache web/.next
