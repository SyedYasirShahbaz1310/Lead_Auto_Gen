import logging
from typing import Optional, Dict, Any, List
try:
    from backend.services.sheets_db import db
except ImportError:
    from services.sheets_db import db

logger = logging.getLogger("KeyService")

class KeyRotationService:
    def __init__(self):
        self.orchestrator = None  # Injected circular dependency resolver

    def set_orchestrator(self, orchestrator):
        self.orchestrator = orchestrator

    async def get_active_key(self, provider: str) -> Optional[Dict[str, Any]]:
        """
        Fetch the first available ACTIVE key for a provider from Sheet 3.
        """
        keys = await db.get_api_keys(provider=provider)
        active_keys = [k for k in keys if k.get("status") == "ACTIVE"]
        
        if active_keys:
            # Return the key with lowest calls or first in queue
            return active_keys[0]
        
        logger.warning(f"No active API key found for provider: {provider}")
        return None

    async def record_call(self, key_info: Dict[str, Any]):
        """
        Increment the calls made counter in Sheet 3 for the given key.
        """
        row_idx = key_info.get("row_index")
        calls = key_info.get("calls_made", 0)
        if row_idx:
            try:
                await db.increment_key_calls(row_idx, calls)
            except Exception as e:
                logger.error(f"Failed to increment key call count: {e}")

    async def mark_exhausted_and_rotate(self, provider: str, key_info: Dict[str, Any], reason: str = "Quota Exceeded") -> Optional[Dict[str, Any]]:
        """
        Mark the current key as EXHAUSTED in Sheet 3 on HTTP 402/429.
        Try to find another ACTIVE key for the same provider.
        If no active key remains, pause the global pipeline and broadcast alert.
        """
        row_idx = key_info.get("row_index")
        key_val = key_info.get("api_key", "")
        masked_key = f"{key_val[:4]}...{key_val[-4:]}" if len(key_val) > 8 else "***"
        
        logger.warning(f"Key [{masked_key}] for provider [{provider}] exhausted ({reason}). Updating Sheet 3...")
        if row_idx:
            await db.update_key_status(row_idx, "EXHAUSTED")

        # Try to find another active key
        next_key = await self.get_active_key(provider)
        if next_key:
            logger.info(f"Successfully rotated to next active key for provider [{provider}]")
            if self.orchestrator:
                await self.orchestrator.broadcast({
                    "type": "KEY_ROTATED",
                    "provider": provider,
                    "message": f"Provider [{provider}] rotated to new active key ({next_key.get('email_account')}).",
                    "status": "info"
                })
            return next_key
        
        # No active keys left -> PAUSE PIPELINE & NOTIFY
        logger.error(f"Provider [{provider}] has NO active keys left. Pausing pipeline.")
        if self.orchestrator:
            await self.orchestrator.pause_pipeline(
                reason=f"Provider [{provider.upper()}] Quota Exceeded. Pipeline Paused. Please inject or reactivate a key."
            )
            await self.orchestrator.broadcast({
                "type": "QUOTA_EXCEEDED",
                "provider": provider,
                "message": f"Provider [{provider.upper()}] Quota Exceeded. Pipeline Paused.",
                "status": "error"
            })
        return None

    async def activate_key(self, row_index: int, resume_pipeline: bool = True) -> bool:
        """
        Reactivate an exhausted key and optionally resume the engine.
        """
        await db.update_key_status(row_index, "ACTIVE")
        logger.info(f"Reactivated key at row {row_index}")
        
        if resume_pipeline and self.orchestrator:
            await self.orchestrator.resume_pipeline()
            await self.orchestrator.broadcast({
                "type": "PIPELINE_RESUMED",
                "message": "Key activated. Pipeline resumed successfully.",
                "status": "success"
            })
        return True

    async def inject_key(self, provider: str, email: str, key: str, key_type: str = "FREE", auto_resume: bool = True) -> bool:
        """
        Inject a new key into Sheet 3 and activate it.
        """
        success = await db.add_api_key(provider=provider, email_account=email, api_key=key, key_type=key_type, status="ACTIVE")
        if success and auto_resume and self.orchestrator:
            if self.orchestrator.is_paused():
                await self.orchestrator.resume_pipeline()
                await self.orchestrator.broadcast({
                    "type": "PIPELINE_RESUMED",
                    "message": f"New key injected for [{provider.upper()}]. Pipeline resumed.",
                    "status": "success"
                })
        return success

key_service = KeyRotationService()
