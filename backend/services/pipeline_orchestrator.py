import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Set, Optional
from fastapi import WebSocket

try:
    from backend.services.sheets_db import db
    from backend.services.key_service import key_service
    from backend.services.miner_service import miner_service
    from backend.services.scraper_service import scraper_service
    from backend.services.verifier_service import verifier_service
    from backend.services.dispatcher_service import dispatcher_service
except ImportError:
    from services.sheets_db import db
    from services.key_service import key_service
    from services.miner_service import miner_service
    from services.scraper_service import scraper_service
    from services.verifier_service import verifier_service
    from services.dispatcher_service import dispatcher_service

logger = logging.getLogger("PipelineOrchestrator")

class PipelineOrchestrator:
    def __init__(self):
        self.state: str = "IDLE"  # IDLE, RUNNING, PAUSED, STOPPED
        self.pause_reason: Optional[str] = None
        self.active_connections: Set[WebSocket] = set()
        self.bg_task: Optional[asyncio.Task] = None
        self.logs: List[Dict[str, Any]] = []
        self._lock: Optional[asyncio.Lock] = None
        
        # Link key service to orchestrator for pause triggers
        key_service.set_orchestrator(self)

    @property
    def lock(self) -> asyncio.Lock:
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock

    def is_paused(self) -> bool:
        return self.state == "PAUSED"

    def is_running(self) -> bool:
        return self.state == "RUNNING"

    async def connect_ws(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket client connected. Total connections: {len(self.active_connections)}")
        
        # Send initial state and recent logs
        await websocket.send_text(json.dumps({
            "type": "INITIAL_STATE",
            "state": self.state,
            "pause_reason": self.pause_reason,
            "logs": self.logs[-30:]
        }))

    def disconnect_ws(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket client disconnected. Remaining: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        """
        Broadcast structured event to all connected WebSocket clients and append to logs.
        """
        message["timestamp"] = datetime.utcnow().strftime("%H:%M:%S")
        self.logs.append(message)
        if len(self.logs) > 200:
            self.logs = self.logs[-200:]

        payload = json.dumps(message)
        dead_connections = set()
        for conn in list(self.active_connections):
            try:
                await conn.send_text(payload)
            except Exception:
                dead_connections.add(conn)

        for dead in dead_connections:
            self.active_connections.discard(dead)

    async def get_stats(self) -> Dict[str, Any]:
        """
        Fetch real-time stats across all 3 sheets.
        """
        try:
            raw_leads = await db.get_raw_domains()
            verified_leads = await db.get_verified_leads()
            keys = await db.get_api_keys()

            mined_count = len(raw_leads)
            scraped_count = len([r for r in raw_leads if r.get("raw_email")])
            pending_count = len([r for r in raw_leads if r.get("scrape_status") == "PENDING"])
            verified_count = len(verified_leads)
            dispatched_count = len([v for v in verified_leads if v.get("outreach_status") == "SENT"])
            ready_count = len([v for v in verified_leads if v.get("outreach_status") == "READY"])

            return {
                "state": self.state,
                "pause_reason": self.pause_reason,
                "total_mined": mined_count,
                "emails_scraped": scraped_count,
                "pending_scraping": pending_count,
                "verified_leads": verified_count,
                "ready_outreach": ready_count,
                "emails_dispatched": dispatched_count,
                "total_keys": len(keys),
                "active_keys": len([k for k in keys if k.get("status") == "ACTIVE"]),
                "exhausted_keys": len([k for k in keys if k.get("status") == "EXHAUSTED"])
            }
        except Exception as e:
            logger.error(f"Error fetching stats: {e}")
            return {
                "state": self.state,
                "pause_reason": self.pause_reason,
                "total_mined": 0,
                "emails_scraped": 0,
                "pending_scraping": 0,
                "verified_leads": 0,
                "ready_outreach": 0,
                "emails_dispatched": 0,
                "total_keys": 0,
                "active_keys": 0,
                "exhausted_keys": 0
            }

    async def start_pipeline(self):
        async with self.lock:
            if self.state == "RUNNING":
                return
            self.state = "RUNNING"
            self.pause_reason = None
            
            await self.broadcast({
                "type": "STATUS_CHANGE",
                "state": "RUNNING",
                "message": "Engine started. Autonomous background pipeline is active.",
                "status": "success"
            })

            if not self.bg_task or self.bg_task.done():
                self.bg_task = asyncio.create_task(self._pipeline_loop())

    async def pause_pipeline(self, reason: Optional[str] = None):
        async with self.lock:
            self.state = "PAUSED"
            self.pause_reason = reason or "Engine manually paused by operator."
            
            await self.broadcast({
                "type": "STATUS_CHANGE",
                "state": "PAUSED",
                "pause_reason": self.pause_reason,
                "message": self.pause_reason,
                "status": "warning"
            })

    async def resume_pipeline(self):
        async with self.lock:
            self.state = "RUNNING"
            self.pause_reason = None
            
            await self.broadcast({
                "type": "STATUS_CHANGE",
                "state": "RUNNING",
                "message": "Engine resumed. Pipeline processing active leads.",
                "status": "success"
            })

            if not self.bg_task or self.bg_task.done():
                self.bg_task = asyncio.create_task(self._pipeline_loop())

    async def stop_pipeline(self):
        async with self.lock:
            self.state = "IDLE"
            self.pause_reason = None
            
            if self.bg_task and not self.bg_task.done():
                self.bg_task.cancel()

            await self.broadcast({
                "type": "STATUS_CHANGE",
                "state": "IDLE",
                "message": "Engine stopped.",
                "status": "info"
            })

    async def _pipeline_loop(self):
        """
        Continuous master loop coordinating Stages 1 -> 2 -> 3 -> 4.
        """
        logger.info("Pipeline master loop started.")
        while self.state == "RUNNING":
            try:
                # Stage 1: Mine if pending leads < 10
                raw_leads = await db.get_raw_domains(status="PENDING")
                if len(raw_leads) < 5 and self.state == "RUNNING":
                    await self.broadcast({
                        "type": "STAGE_START",
                        "stage": "STAGE_1_MINER",
                        "message": "Stage 1: Mining new niche e-commerce domains via DomainsDB API...",
                        "status": "info"
                    })
                    mine_res = await miner_service.mine_domains(limit=15)
                    await self.broadcast({
                        "type": "STAGE_COMPLETE",
                        "stage": "STAGE_1_MINER",
                        "message": f"Stage 1 Complete: Added {mine_res.get('count', 0)} new domains to Sheet 1.",
                        "status": "success"
                    })
                    await asyncio.sleep(2)

                if self.state != "RUNNING":
                    break

                # Stage 2: Scrape PENDING leads
                await self.broadcast({
                    "type": "STAGE_START",
                    "stage": "STAGE_2_SCRAPER",
                    "message": "Stage 2: Scanning websites & Hunter/Tomba fallback for executive emails...",
                    "status": "info"
                })
                scrape_res = await scraper_service.scrape_pending(batch_size=5)
                await self.broadcast({
                    "type": "STAGE_COMPLETE",
                    "stage": "STAGE_2_SCRAPER",
                    "message": f"Stage 2 Complete: Scraped {scrape_res.get('processed', 0)} leads.",
                    "status": "success"
                })
                await asyncio.sleep(2)

                if self.state != "RUNNING":
                    break

                # Stage 3: Verify DONE leads
                await self.broadcast({
                    "type": "STAGE_START",
                    "stage": "STAGE_3_VERIFIER",
                    "message": "Stage 3: Running DNS MX checks & APILayer deliverability validation...",
                    "status": "info"
                })
                verify_res = await verifier_service.verify_done_leads(batch_size=5)
                await self.broadcast({
                    "type": "STAGE_COMPLETE",
                    "stage": "STAGE_3_VERIFIER",
                    "message": f"Stage 3 Complete: Verified {verify_res.get('processed', 0)} leads (Pushed deliverable >90% to Sheet 2).",
                    "status": "success"
                })
                await asyncio.sleep(2)

                if self.state != "RUNNING":
                    break

                # Stage 4: Dispatch READY leads
                ready_leads = await db.get_verified_leads(status="READY")
                if ready_leads and self.state == "RUNNING":
                    await self.broadcast({
                        "type": "STAGE_START",
                        "stage": "STAGE_4_DISPATCHER",
                        "message": f"Stage 4: Generating Gemini 100-word cold emails & sending via Brevo for {len(ready_leads[:2])} leads...",
                        "status": "info"
                    })
                    dispatch_res = await dispatcher_service.dispatch_ready_queue(max_items=2)
                    await self.broadcast({
                        "type": "STAGE_COMPLETE",
                        "stage": "STAGE_4_DISPATCHER",
                        "message": f"Stage 4 Complete: Dispatched {dispatch_res.get('dispatched', 0)} personalized emails.",
                        "status": "success"
                    })

                # Sleep before next cycle
                await asyncio.sleep(5)

            except asyncio.CancelledError:
                logger.info("Pipeline master loop cancelled.")
                break
            except Exception as e:
                logger.error(f"Error in pipeline loop: {e}")
                await self.broadcast({
                    "type": "ERROR",
                    "message": f"Pipeline iteration error: {str(e)}",
                    "status": "error"
                })
                await asyncio.sleep(10)

orchestrator = PipelineOrchestrator()
