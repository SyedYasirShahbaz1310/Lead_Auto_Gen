import os
import sys
import traceback
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import JSONResponse

# Add paths
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"

for p in [str(root_dir), str(backend_dir), "/var/task", "/var/task/backend"]:
    if p not in sys.path and os.path.exists(p):
        sys.path.insert(0, p)

import_error = None
try:
    from backend.main import app
except Exception as e:
    err1 = traceback.format_exc()
    try:
        from main import app
    except Exception as e2:
        err2 = traceback.format_exc()
        import_error = f"Backend Import Error:\n{err1}\n\nMain Import Error:\n{err2}"
        app = FastAPI(title="LenGen Debug Bridge")
        
        @app.get("/api/health")
        @app.get("/api/{full_path:path}")
        async def catch_all(full_path: str = ""):
            return JSONResponse({
                "status": "import_failed",
                "detail": import_error,
                "sys_path": sys.path,
                "cwd": os.getcwd(),
                "files_in_task": os.listdir("/var/task") if os.path.exists("/var/task") else [],
            })
