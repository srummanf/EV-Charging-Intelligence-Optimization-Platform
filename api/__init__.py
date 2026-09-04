"""FastAPI service for the EV Charging Intelligence & Optimization Platform.

``api.app:app`` is the ASGI application. It loads the trained ``.joblib`` artifacts and
the precomputed ``analytics.json`` once at startup (see ``api.state``) and serves them
through the routes in ``api.routes``.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Work whether or not the package has been ``pip install``-ed: put ``src/`` on the path
# so ``import evcharging`` resolves when running ``uvicorn api.app:app`` from a checkout.
_SRC = Path(__file__).resolve().parents[1] / "src"
if _SRC.is_dir() and str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))
