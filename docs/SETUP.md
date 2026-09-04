# Setup

Detailed local setup and the gotchas that will actually bite you. For the one-command
container path, see the [root README](../README.md#11-setup).

## Prerequisites

| Tool | Version | Needed for |
| --- | --- | --- |
| Python | 3.10+ (CI uses 3.12) | the pipeline, models, API, tests |
| Node.js + npm | 20+ (CI uses 22) | the dashboard only |
| Docker + Docker Compose | any recent | optional — the one-command stack |
| git | any | clone |

No external accounts, API keys, or databases.

## 1. Clone

```bash
git clone https://github.com/srummanf/EV-Charging-Intelligence-Optimization-Platform.git
cd EV-Charging-Intelligence-Optimization-Platform
```

## 2. Python environment

```bash
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
python -m pip install --upgrade pip
pip install -e ".[dev,api,viz]"
```

`pip install -e .` installs the `evcharging` package in editable mode so `import
evcharging` works from anywhere. The optional extras (`pyproject.toml`):

| Extra | Contents | When you need it |
| --- | --- | --- |
| `dev` | pytest, ruff, jupyter, ipykernel | tests, lint, notebooks |
| `api` | fastapi, uvicorn[standard], httpx | running / testing the API |
| `viz` | matplotlib, seaborn, shap | the notebooks (plots + SHAP) |
| `tracking` | mlflow | `train_all.py --track` only |

`requirements.txt` is an alternative that pulls the whole set at once.

`make setup` runs the venv creation + `pip install -e ".[dev,api,viz]"` for you.

## 3. Node environment (dashboard only)

```bash
cd web
npm install
cd ..
```

## 4. Verify it works

```bash
python scripts/prepare_data.py       # writes data/processed/*.parquet + *.json
python scripts/train_all.py          # writes models/*.joblib + metrics.json + analytics.json
pytest -q                            # -> 69 passed
ruff check .                         # -> All checks passed!
cd web && npm run lint && npm run build && cd ..   # eslint clean + "Compiled successfully"
```

If all four succeed, the project is set up correctly. The
[Walkthrough](WALKTHROUGH.md) shows the expected output of each command in detail.

## Environment variables

Every variable has a working default; you only set these to override.

| Variable | Used by | Default |
| --- | --- | --- |
| `EVCHARGING_CORS_ORIGINS` | API — comma-separated allowed browser origins | `http://localhost:3000,http://127.0.0.1:3000` |
| `NEXT_PUBLIC_API_BASE_URL` | dashboard, baked into the browser bundle at build | `http://localhost:8000` |
| `INTERNAL_API_BASE_URL` | dashboard, server-side rendering only (Docker Compose sets it to `http://api:8000`) | falls back to `NEXT_PUBLIC_API_BASE_URL` |
| `MLFLOW_TRACKING_URI` | `train_all.py --track` | `sqlite:///mlflow.db` |

For local dev, to point the dashboard at a non-default API, create `web/.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Gotchas

### `import evcharging` fails in a plain REPL or a notebook

The training scripts prepend `src/` to `sys.path` themselves, and the notebooks do
`sys.path.insert(0, "../src")`. A bare `python` session does neither. Fix with
`pip install -e .` (recommended) or `PYTHONPATH=src python ...`.

### Jupyter uses a different Python than your venv

Symptom: `ModuleNotFoundError` for packages you just installed, or scikit-learn
"InconsistentVersionWarning" when a notebook loads a `.joblib`. Cause: Jupyter is
launched from a different interpreter than the venv. Fix: register and select the venv
kernel.

```bash
python -m ipykernel install --user --name evcharging --display-name "Python (evcharging)"
```

Then pick "Python (evcharging)" in Jupyter. Keep scikit-learn the same version in every
environment that reads `models/*.joblib`.

### `web/.env.example` is not in git

`web/.gitignore` ignores `.env*`, so a fresh clone has no `.env.example`. This is
harmless — `NEXT_PUBLIC_API_BASE_URL` defaults to `http://localhost:8000`. Create
`web/.env.local` yourself only if you need a different URL.

### `docker compose build web` fails with `"/web": not found`

The committed `.dockerignore` excludes the `web/` directory from the build context. A
one-line fix (replace the `web` line with `**/node_modules` + `**/.next`) is staged in
the working tree and needs to be committed. Until then, build the API image only
(`docker compose build api`) and run the dashboard locally.

### `train_all.py --track` complains about the MLflow file store

Recent MLflow deprecated the bare-directory (`./mlruns`) store. The script defaults the
tracking URI to `sqlite:///mlflow.db`; browse runs with
`mlflow ui --backend-store-uri sqlite:///mlflow.db`. Set `MLFLOW_TRACKING_URI` to use a
server instead.

### Windows line endings

The repo is LF. Git may print `LF will be replaced by CRLF` warnings on checkout — this
is cosmetic and does not affect anything.

### First Docker build is slow

`api/Dockerfile` runs `prepare_data.py` + `train_all.py` + `build_analytics.py` at build
time so the image is self-contained. Expect a few minutes on the first build; it is
cached afterwards.
