import os
import sys
from pathlib import Path

# Dynamically add all potential paths to sys.path
current_file = Path(__file__).resolve()
candidates = [
    current_file.parent,
    current_file.parent.parent,
    Path(os.getcwd()),
    Path("/var/task"),
    Path("/var/task/backend"),
]

for base in candidates:
    if base.exists():
        s_base = str(base)
        if s_base not in sys.path:
            sys.path.insert(0, s_base)
        backend_sub = base / "backend"
        if backend_sub.exists() and str(backend_sub) not in sys.path:
            sys.path.insert(0, str(backend_sub))

try:
    from backend.main import app
except Exception as e1:
    try:
        from main import app
    except Exception as e2:
        from fastapi import FastAPI
        app = FastAPI(title="LenGen Fallback API")
        
        @app.get("/api/health")
        @app.get("/api/{path:path}")
        async def fallback_handler(path: str = ""):
            import traceback
            return {
                "status": "error",
                "message": "Backend import failed on Vercel Serverless",
                "error_backend": str(e1),
                "error_main": str(e2),
                "traceback": traceback.format_exc(),
                "cwd": os.getcwd(),
                "sys_path": sys.path
            }

# Vercel ASGI entry point
app = app
