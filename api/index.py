import os
import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Initialize top-level ASGI FastAPI app for Vercel
app = FastAPI(
    title="LenGen Autonomous Cold Outreach Engine",
    description="Production-grade Zero-SQL Lead Gen Engine",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add paths
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
for p in [str(root_dir), str(backend_dir), "/var/task", "/var/task/backend"]:
    if p not in sys.path and os.path.exists(p):
        sys.path.insert(0, p)

try:
    from backend.main import (
        health_check, get_dashboard_stats, get_raw_leads, get_verified_leads,
        start_mining_stage, start_scraping_stage, start_verifier_stage, start_dispatcher_stage,
        upload_domain_file, get_api_keys, inject_new_key, activate_existing_key,
        export_all_leads, preview_email_generation, approve_and_dispatch_email,
        delete_raw_leads_endpoint, delete_verified_leads_endpoint,
        start_pipeline, pause_pipeline, resume_pipeline, stop_pipeline
    )
    
    app.add_api_route("/api/health", health_check, methods=["GET"])
    app.add_api_route("/api/stats", get_dashboard_stats, methods=["GET"])
    app.add_api_route("/api/leads/raw", get_raw_leads, methods=["GET"])
    app.add_api_route("/api/leads/raw", delete_raw_leads_endpoint, methods=["DELETE"])
    app.add_api_route("/api/leads/verified", get_verified_leads, methods=["GET"])
    app.add_api_route("/api/leads/verified", delete_verified_leads_endpoint, methods=["DELETE"])
    app.add_api_route("/api/leads/export", export_all_leads, methods=["GET"])
    app.add_api_route("/api/leads/upload", upload_domain_file, methods=["POST"])
    app.add_api_route("/api/keys", get_api_keys, methods=["GET"])
    app.add_api_route("/api/keys", inject_new_key, methods=["POST"])
    app.add_api_route("/api/keys/activate", activate_existing_key, methods=["POST"])
    app.add_api_route("/api/pipeline/mine", start_mining_stage, methods=["POST"])
    app.add_api_route("/api/pipeline/scrape", start_scraping_stage, methods=["POST"])
    app.add_api_route("/api/pipeline/verify", start_verifier_stage, methods=["POST"])
    app.add_api_route("/api/pipeline/dispatch", start_dispatcher_stage, methods=["POST"])
    app.add_api_route("/api/pipeline/dispatch/preview", preview_email_generation, methods=["POST"])
    app.add_api_route("/api/pipeline/dispatch/approve", approve_and_dispatch_email, methods=["POST"])
    app.add_api_route("/api/pipeline/start", start_pipeline, methods=["POST"])
    app.add_api_route("/api/pipeline/pause", pause_pipeline, methods=["POST"])
    app.add_api_route("/api/pipeline/resume", resume_pipeline, methods=["POST"])
    app.add_api_route("/api/pipeline/stop", stop_pipeline, methods=["POST"])

except Exception as e:
    import traceback
    err_trace = traceback.format_exc()
    @app.get("/api/health")
    @app.get("/api/{path:path}")
    async def fallback_diag(path: str = ""):
        return {
            "status": "error",
            "message": f"Route loading error: {str(e)}",
            "traceback": err_trace,
            "sys_path": sys.path,
            "cwd": os.getcwd()
        }
