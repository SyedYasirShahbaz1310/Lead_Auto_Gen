import logging
import asyncio
import sys
import re
import json
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, List

# Ensure project root and backend directory are in sys.path
backend_dir = Path(__file__).resolve().parent
project_root = backend_dir.parent
for p in [str(project_root), str(backend_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from backend.config import settings
    from backend.services.sheets_db import db
    from backend.services.key_service import key_service
    from backend.services.miner_service import miner_service
    from backend.services.scraper_service import scraper_service
    from backend.services.verifier_service import verifier_service
    from backend.services.dispatcher_service import dispatcher_service
    from backend.services.pipeline_orchestrator import orchestrator
except ImportError:
    from config import settings
    from services.sheets_db import db
    from services.key_service import key_service
    from services.miner_service import miner_service
    from services.scraper_service import scraper_service
    from services.verifier_service import verifier_service
    from services.dispatcher_service import dispatcher_service
    from services.pipeline_orchestrator import orchestrator

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("LenGenEngine")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up Lead Generation & Outreach Engine...")
    try:
        await db.initialize()
        logger.info("Google Sheets Primary Database initialized successfully.")
    except Exception as e:
        logger.warning(f"Google Sheets init warning (will retry on demand): {e}")
    yield
    logger.info("Shutting down engine...")
    await orchestrator.stop_pipeline()

app = FastAPI(
    title="LenGen Autonomous Cold Outreach Engine",
    description="Production-grade Zero-SQL Lead Gen, Verification, AI Personalization & Cold Outreach Engine",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Request Models
class KeyInjectionRequest(BaseModel):
    provider: str
    email_account: str
    api_key: str
    key_type: str = "FREE"
    auto_resume: bool = True

class KeyActivateRequest(BaseModel):
    row_index: int
    resume_pipeline: bool = True

class MineRequest(BaseModel):
    keyword: Optional[str] = None
    zone: str = "com"
    limit: int = 20

class ScrapeRequest(BaseModel):
    batch_size: int = 10

class VerifyRequest(BaseModel):
    batch_size: int = 10

class DispatchRequest(BaseModel):
    max_items: int = 5
    fast_mode: bool = False

class PreviewEmailRequest(BaseModel):
    domain: str
    email: str
    company_name: Optional[str] = None

class ApproveEmailRequest(BaseModel):
    row_index: int
    domain: str
    email: str
    subject: str
    body: str

class DeleteRawLeadsRequest(BaseModel):
    domains: List[str]

class DeleteVerifiedLeadsRequest(BaseModel):
    emails: List[str]
    domains: Optional[List[str]] = None

# ================= REST ENDPOINTS =================

@app.get("/api/health")
async def health_check():
    return {
        "status": "online",
        "engine_state": orchestrator.state,
        "database": "Google Sheets (gspread)",
        "sheet_id": settings.GOOGLE_SHEET_ID
    }

@app.get("/api/stats")
async def get_dashboard_stats():
    return await orchestrator.get_stats()

@app.get("/api/leads/raw")
async def get_raw_leads(status: Optional[str] = Query(None)):
    leads = await db.get_raw_domains(status=status)
    return {"leads": leads, "count": len(leads)}

@app.delete("/api/leads/raw")
async def delete_raw_leads_endpoint(req: DeleteRawLeadsRequest):
    """
    Delete selected domains from Sheet 1 (Raw_Scraped_Domains).
    """
    deleted_count = await db.delete_raw_domains(req.domains)
    await orchestrator.broadcast({
        "type": "LEADS_DELETED",
        "sheet": "Raw_Scraped_Domains",
        "count": deleted_count,
        "message": f"Successfully deleted {deleted_count} lead(s) from Sheet 1.",
        "status": "info"
    })
    return {"status": "success", "deleted_count": deleted_count}

@app.get("/api/leads/verified")
async def get_verified_leads(status: Optional[str] = Query(None)):
    leads = await db.get_verified_leads(status=status)
    return {"leads": leads, "count": len(leads)}

@app.delete("/api/leads/verified")
async def delete_verified_leads_endpoint(req: DeleteVerifiedLeadsRequest):
    """
    Delete selected verified leads from Sheet 2 (Verified_Outreach_Queue).
    """
    deleted_count = await db.delete_verified_leads(emails=req.emails, domains=req.domains)
    await orchestrator.broadcast({
        "type": "LEADS_DELETED",
        "sheet": "Verified_Outreach_Queue",
        "count": deleted_count,
        "message": f"Successfully deleted {deleted_count} lead(s) from Sheet 2.",
        "status": "info"
    })
    return {"status": "success", "deleted_count": deleted_count}

@app.get("/api/leads/export")
async def export_all_leads():
    raw_leads = await db.get_raw_domains()
    verified_leads = await db.get_verified_leads()
    return {
        "raw_leads": raw_leads,
        "verified_leads": verified_leads
    }

@app.get("/api/keys")
async def get_api_keys(provider: Optional[str] = Query(None)):
    keys = await db.get_api_keys(provider=provider)
    return {"keys": keys, "count": len(keys)}

@app.post("/api/keys")
async def inject_new_key(req: KeyInjectionRequest):
    success = await key_service.inject_key(
        provider=req.provider,
        email=req.email_account,
        key=req.api_key,
        key_type=req.key_type,
        auto_resume=req.auto_resume
    )
    return {"success": success, "message": f"Injected key for {req.provider.upper()}"}

@app.post("/api/keys/activate")
async def activate_existing_key(req: KeyActivateRequest):
    success = await key_service.activate_key(
        row_index=req.row_index,
        resume_pipeline=req.resume_pipeline
    )
    return {"success": success, "message": "Key activated successfully"}

# ================= PIPELINE CONTROLS =================

@app.post("/api/pipeline/start")
async def start_pipeline():
    await orchestrator.start_pipeline()
    return {"state": orchestrator.state, "message": "Pipeline started"}

@app.post("/api/pipeline/pause")
async def pause_pipeline():
    await orchestrator.pause_pipeline("Manually paused via UI")
    return {"state": orchestrator.state, "message": "Pipeline paused"}

@app.post("/api/pipeline/resume")
async def resume_pipeline():
    await orchestrator.resume_pipeline()
    return {"state": orchestrator.state, "message": "Pipeline resumed"}

@app.post("/api/pipeline/stop")
async def stop_pipeline():
    await orchestrator.stop_pipeline()
    return {"state": orchestrator.state, "message": "Pipeline stopped"}

# Manual Stage Triggers
@app.post("/api/pipeline/mine")
async def trigger_miner(req: MineRequest):
    await orchestrator.broadcast({
        "type": "STAGE_MANUAL_TRIGGER",
        "stage": "STAGE_1_MINER",
        "message": f"Manually triggering domain mining for '{req.keyword or 'ecommerce niches'}'...",
        "status": "info"
    })
    res = await miner_service.mine_domains(keyword=req.keyword, zone=req.zone, limit=req.limit)
    await orchestrator.broadcast({
        "type": "STAGE_COMPLETE",
        "stage": "STAGE_1_MINER",
        "message": f"Manual Mining finished: Added {res.get('count', 0)} domains.",
        "status": "success"
    })
    return res

@app.post("/api/pipeline/scrape")
async def trigger_scraper(req: ScrapeRequest):
    await orchestrator.broadcast({
        "type": "STAGE_MANUAL_TRIGGER",
        "stage": "STAGE_2_SCRAPER",
        "message": f"Manually triggering email scraper (batch size {req.batch_size})...",
        "status": "info"
    })
    res = await scraper_service.scrape_pending(batch_size=req.batch_size)
    await orchestrator.broadcast({
        "type": "STAGE_COMPLETE",
        "stage": "STAGE_2_SCRAPER",
        "message": f"Manual Scraping finished: Processed {res.get('processed', 0)} leads.",
        "status": "success"
    })
    return res

@app.post("/api/pipeline/verify")
async def trigger_verifier(req: VerifyRequest):
    await orchestrator.broadcast({
        "type": "STAGE_MANUAL_TRIGGER",
        "stage": "STAGE_3_VERIFIER",
        "message": f"Manually triggering email verifier (batch size {req.batch_size})...",
        "status": "info"
    })
    res = await verifier_service.verify_done_leads(batch_size=req.batch_size)
    await orchestrator.broadcast({
        "type": "STAGE_COMPLETE",
        "stage": "STAGE_3_VERIFIER",
        "message": f"Manual Verification finished: Processed {res.get('processed', 0)} leads.",
        "status": "success"
    })
    return res

@app.post("/api/pipeline/dispatch")
async def trigger_dispatcher(req: DispatchRequest):
    await orchestrator.broadcast({
        "type": "STAGE_MANUAL_TRIGGER",
        "stage": "STAGE_4_DISPATCHER",
        "message": f"Manually triggering AI Cold Outreach Dispatch (max {req.max_items} leads)...",
        "status": "info"
    })
    res = await dispatcher_service.dispatch_ready_queue(max_items=req.max_items, fast_mode=req.fast_mode)
    await orchestrator.broadcast({
        "type": "STAGE_COMPLETE",
        "stage": "STAGE_4_DISPATCHER",
        "message": f"Manual Dispatch finished: Sent {res.get('dispatched', 0)} emails.",
        "status": "success"
    })
@app.post("/api/pipeline/preview-email")
async def preview_cold_email(req: PreviewEmailRequest):
    """
    Generate AI cold outreach email preview for manual review and editing.
    """
    return await dispatcher_service.generate_preview(
        domain=req.domain,
        email=req.email,
        company_name=req.company_name
    )

@app.post("/api/pipeline/dispatch/approve")
async def dispatch_approved_email(req: ApproveEmailRequest):
    """
    Dispatch operator-approved cold email via Brevo and update Sheet 2.
    """
    await orchestrator.broadcast({
        "type": "EMAIL_APPROVED_DISPATCH",
        "domain": req.domain,
        "email": req.email,
        "message": f"Dispatching approved outreach to {req.email} ({req.domain})...",
        "status": "info"
    })
    res = await dispatcher_service.send_approved_email(
        row_index=req.row_index,
        domain=req.domain,
        email=req.email,
        subject=req.subject,
        body=req.body
    )
    await orchestrator.broadcast({
        "type": "STAGE_COMPLETE",
        "stage": "STAGE_4_DISPATCHER",
        "message": f"Successfully sent approved outreach email to {req.email}!",
        "status": "success"
    })
    return res

@app.post("/api/leads/upload")
async def upload_domain_file(file: UploadFile = File(...)):
    """
    Upload CSV, Excel (.xlsx), or TXT file with domains, parse, validate DNS, and add to Sheet 1.
    """
    filename = file.filename or ""
    content = await file.read()
    
    extracted_domains = []
    
    HEADER_WORDS = {"domain", "domains", "url", "urls", "website", "websites", "site", "sites", "link", "links", "company"}
    try:
        if filename.endswith(".csv") or filename.endswith(".txt"):
            text_str = content.decode("utf-8", errors="ignore")
            lines = text_str.splitlines()
            for line in lines:
                parts = re.split(r"[,;\t\s]+", line)
                for part in parts:
                    clean = part.replace("https://", "").replace("http://", "").replace("www.", "").strip().lower().split("/")[0]
                    if clean and clean not in HEADER_WORDS and "." in clean and not any(clean.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".csv", ".txt", ".pdf"]):
                        if clean not in extracted_domains:
                            extracted_domains.append(clean)
                            
        elif filename.endswith(".xlsx"):
            import openpyxl, io
            wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
            ws = wb.active
            for row in ws.iter_rows(values_only=True):
                for cell in row:
                    if cell:
                        cell_str = str(cell).replace("https://", "").replace("http://", "").replace("www.", "").strip().lower().split("/")[0]
                        if cell_str and cell_str not in HEADER_WORDS and "." in cell_str and not any(cell_str.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".csv", ".txt", ".pdf"]):
                            if cell_str not in extracted_domains:
                                extracted_domains.append(cell_str)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload .csv, .xlsx, or .txt")

    except Exception as e:
        logger.error(f"Error parsing uploaded file: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    if not extracted_domains:
        raise HTTPException(status_code=400, detail="No valid domains found in uploaded file.")

    # Filter DNS-valid domains
    valid_domains = [dom for dom in extracted_domains if miner_service._verify_dns_exists(dom)]
    if not valid_domains:
        raise HTTPException(status_code=400, detail="None of the uploaded domains resolved on public DNS.")

    await orchestrator.broadcast({
        "type": "STAGE_START",
        "stage": "CUSTOM_UPLOAD_ANALYSIS",
        "message": f"Processing {len(valid_domains)} uploaded domains: Crawling websites, identifying exact Niches & analyzing AI Pain Points...",
        "status": "info"
    })

    leads_to_add = []
    for idx, dom in enumerate(valid_domains, start=1):
        try:
            lead_data = await scraper_service.analyze_custom_domain(dom)
            leads_to_add.append(lead_data)
            
            niche = lead_data.get("detected_niche", "Commercial Business")
            pains_snippet = lead_data.get("pain_points", "")[:60]
            await orchestrator.broadcast({
                "type": "DOMAIN_ANALYZED",
                "stage": "CUSTOM_UPLOAD_ANALYSIS",
                "domain": dom,
                "niche": niche,
                "pain_points": lead_data.get("pain_points", ""),
                "message": f"[{idx}/{len(valid_domains)}] Analyzed {dom} -> Niche: [{niche}] | Score: {lead_data.get('need_score', 88)}% | Pain Points: {pains_snippet}...",
                "status": "success"
            })
        except Exception as err:
            logger.error(f"Error analyzing custom domain {dom}: {err}")
            company_name = dom.split(".")[0].replace("-", " ").title()
            leads_to_add.append({
                "domain": dom,
                "company_name": company_name,
                "raw_email": f"contact@{dom}",
                "phone_number": "",
                "detected_niche": "Commercial Business & Digital Services",
                "top_service_need": "AI Automation & Agentic AI",
                "need_score": 85,
                "pain_points": "[Commercial Business & Digital Services] Website lacks automated 24/7 customer interaction touchpoints and high-conversion dynamic funnel infrastructure.",
                "scrape_status": "PENDING"
            })
        await asyncio.sleep(0.1)

    added_count = await db.add_raw_domains(leads_to_add)
    
    await orchestrator.broadcast({
        "type": "DOMAINS_UPLOADED",
        "count": added_count,
        "filename": filename,
        "message": f"Uploaded {filename}: Successfully analyzed & added {added_count} websites with AI Niche & Pain Point detection to Sheet 1!",
        "status": "success"
    })

    return {
        "status": "success",
        "filename": filename,
        "total_parsed": len(extracted_domains),
        "valid_dns_count": len(valid_domains),
        "added_to_sheet": added_count,
        "leads": leads_to_add
    }

@app.get("/api/logs")
async def get_event_logs():
    return {"logs": orchestrator.logs[-50:]}

# ================= WEBSOCKET =================

@app.websocket("/ws/pipeline")
async def websocket_pipeline_endpoint(websocket: WebSocket):
    await orchestrator.connect_ws(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                cmd = msg.get("command")
                if cmd == "START":
                    await orchestrator.start_pipeline()
                elif cmd == "PAUSE":
                    await orchestrator.pause_pipeline("Paused via WebSocket client")
                elif cmd == "RESUME":
                    await orchestrator.resume_pipeline()
                elif cmd == "STOP":
                    await orchestrator.stop_pipeline()
            except Exception as e:
                logger.error(f"Error parsing WS incoming command: {e}")
    except WebSocketDisconnect:
        orchestrator.disconnect_ws(websocket)
    except Exception as e:
        logger.error(f"WS error: {e}")
        orchestrator.disconnect_ws(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
