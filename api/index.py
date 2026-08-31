import os
import sys
from pathlib import Path

# Add paths to sys.path
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"

for p in [str(root_dir), str(backend_dir), "/var/task", "/var/task/backend"]:
    if p not in sys.path and os.path.exists(p):
        sys.path.insert(0, p)

try:
    from backend.main import app
except Exception:
    from main import app

try:
    from mangum import Mangum
    handler = Mangum(app, lifespan="off")
except Exception:
    handler = app

# Vercel entry points
app = app
