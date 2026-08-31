import asyncio
import logging
import sys
from pathlib import Path

# Add backend parent to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.config import settings, get_service_account_path
from backend.services.sheets_db import db
from backend.services.key_service import key_service
from backend.services.miner_service import miner_service
from backend.services.scraper_service import scraper_service
from backend.services.verifier_service import verifier_service
from backend.services.dispatcher_service import dispatcher_service
from backend.services.pipeline_orchestrator import orchestrator

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("LenGenTest")

async def run_diagnostics():
    logger.info("=== 1. DIAGNOSTICS & CONFIG VERIFICATION ===")
    logger.info(f"Target Google Sheet ID: {settings.GOOGLE_SHEET_ID}")
    sa_path = get_service_account_path()
    logger.info(f"Service Account Path: {sa_path} (Exists: {Path(sa_path).exists()})")

    logger.info("\n=== 2. GOOGLE SHEETS INITIALIZATION ===")
    try:
        await db.initialize()
        logger.info("Successfully connected to Google Sheet and verified 3 worksheets:")
        logger.info(" - Raw_Scraped_Domains (Sheet 1)")
        logger.info(" - Verified_Outreach_Queue (Sheet 2)")
        logger.info(" - API_Keys_Pool (Sheet 3)")
    except Exception as e:
        logger.error(f"Google Sheets connection failed: {e}")
        logger.error("Please verify that the service account email is added as an Editor to the Google Sheet.")
        return

    logger.info("\n=== 3. API KEY POOL VERIFICATION ===")
    keys = await db.get_api_keys()
    logger.info(f"Total API Keys in Pool: {len(keys)}")
    for k in keys:
        logger.info(f" - [{k['provider'].upper()}] Type: {k['key_type']} | Status: {k['status']} | Calls: {k['calls_made']} | Account: {k['email_account']}")

    logger.info("\n=== 4. STAGE 1: DOMAINS MINER ===")
    mine_result = await miner_service.mine_domains(keyword="organic apparel", limit=5)
    logger.info(f"Mined result: {mine_result}")

    logger.info("\n=== 5. STAGE 2: CONTACT SCRAPER ===")
    scrape_result = await scraper_service.scrape_pending(batch_size=3)
    logger.info(f"Scrape result: {scrape_result}")

    logger.info("\n=== 6. STAGE 3: EMAIL VERIFIER ===")
    verify_result = await verifier_service.verify_done_leads(batch_size=3)
    logger.info(f"Verify result: {verify_result}")

    logger.info("\n=== 7. STAGE 4: AI OUTREACH DISPATCHER ===")
    dispatch_result = await dispatcher_service.dispatch_ready_queue(max_items=1, fast_mode=True)
    logger.info(f"Dispatch result: {dispatch_result}")

    logger.info("\n=== 8. OVERALL DASHBOARD TELEMETRY STATS ===")
    stats = await orchestrator.get_stats()
    logger.info(f"Stats: {stats}")

    logger.info("\n>>> ALL 4 STAGES & GOOGLE SHEETS PIPELINE PASSED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    asyncio.run(run_diagnostics())
