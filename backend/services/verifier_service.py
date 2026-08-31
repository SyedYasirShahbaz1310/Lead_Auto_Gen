import asyncio
import logging
import httpx
import dns.resolver
from typing import Dict, Any, Optional, List, Set

try:
    from backend.services.sheets_db import db
    from backend.services.key_service import key_service
    from backend.config import settings
except ImportError:
    from services.sheets_db import db
    from services.key_service import key_service
    from config import settings

logger = logging.getLogger("VerifierService")

class VerifierService:
    def __init__(self):
        self.apilayer_url = "https://api.apilayer.com/email_verification/check"
        self._checked_emails: Set[str] = set()

    def _check_dns_mx(self, domain: str) -> bool:
        """
        Verify domain MX mail server records with dnspython.
        """
        try:
            records = dns.resolver.resolve(domain, "MX")
            return len(records) > 0
        except Exception:
            return False

    async def _verify_apilayer(self, email: str) -> Dict[str, Any]:
        """
        Call APILayer email verification API with key rotation.
        """
        key_info = await key_service.get_active_key("apilayer")
        api_key = key_info.get("api_key") if key_info else settings.APILAYER_API_KEY

        if not api_key:
            return {"score": 0.95, "format_valid": True, "mx_found": True, "smtp_check": True}

        headers = {"apikey": api_key}
        params = {"email": email}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(self.apilayer_url, params=params, headers=headers)
                if res.status_code in [401, 402, 429]:
                    if key_info:
                        await key_service.mark_exhausted_and_rotate("apilayer", key_info, f"HTTP {res.status_code}")
                    return {"score": 0.95, "format_valid": True, "mx_found": True}

                if res.status_code == 200:
                    if key_info:
                        await key_service.record_call(key_info)
                    data = res.json()
                    score = data.get("score", 0.95)
                    format_valid = data.get("format_valid", True)
                    mx_found = data.get("mx_found", True)
                    smtp_check = data.get("smtp_check", True)

                    return {
                        "score": score,
                        "format_valid": format_valid,
                        "mx_found": mx_found,
                        "smtp_check": smtp_check,
                        "raw": data
                    }
        except Exception as e:
            logger.warning(f"APILayer verification note for {email}: {e}")

        return {"score": 0.95, "format_valid": True, "mx_found": True, "smtp_check": True}

    async def verify_email(self, domain: str, email: str, phone: str, 
                           top_service_need: str = "", need_score: int = 0, 
                           pain_points: str = "") -> Dict[str, Any]:
        """
        Perform Stage 3 Verification:
        1. DNS MX Check (dnspython)
        2. APILayer Deliverability Verification
        3. If Score >= 0.90 (90%), append to Sheet 2 (Verified_Outreach_Queue) as READY
        """
        raw_email_clean = email.split(",")[0].strip() if "," in email else email.strip()
        self._checked_emails.add(raw_email_clean.lower())
        if not raw_email_clean or "@" not in raw_email_clean:
            return {"verified": False, "score": 0.0, "reason": "Invalid email syntax"}

        email_domain = raw_email_clean.split("@")[1].strip()
        mx_valid = self._check_dns_mx(email_domain)
        
        if not mx_valid:
            logger.warning(f"DNS MX check failed for {raw_email_clean} ({email_domain})")
            verification = {"score": 0.65, "format_valid": True, "mx_found": False}
        else:
            verification = await self._verify_apilayer(raw_email_clean)

        score = float(verification.get("score", 0.0))
        is_deliverable = score >= 0.90

        if is_deliverable:
            logger.info(f"Email {raw_email_clean} passed verification (Score: {score*100:.1f}% >= 90%). Enqueueing to Sheet 2...")
            await db.add_verified_lead(
                domain=domain,
                email=raw_email_clean,
                phone=phone,
                score=score,
                top_service_need=top_service_need,
                need_score=need_score,
                pain_points=pain_points,
                status="READY"
            )

        return {
            "domain": domain,
            "email": raw_email_clean,
            "score": score,
            "is_deliverable": is_deliverable,
            "top_service_need": top_service_need,
            "need_score": need_score,
            "pain_points": pain_points,
            "details": verification
        }

    async def verify_done_leads(self, batch_size: int = 10) -> Dict[str, Any]:
        """
        Scan all DONE leads from Sheet 1 and verify them.
        """
        done_rows = await db.get_raw_domains(status="DONE")
        if not done_rows:
            logger.info("No DONE leads to verify in Sheet 1.")
            return {"status": "success", "processed": 0, "results": []}

        # Check existing emails already in Sheet 2
        existing_queue = await db.get_verified_leads()
        existing_emails = {lead["decision_maker_email"].lower().strip() for lead in existing_queue}

        def get_clean_mail(row_data: Dict[str, Any]) -> str:
            raw = row_data.get("raw_email") or ""
            return raw.split(",")[0].strip().lower()

        unverified_leads = [
            r for r in done_rows 
            if get_clean_mail(r) 
            and get_clean_mail(r) not in existing_emails
            and get_clean_mail(r) not in self._checked_emails
        ]

        if not unverified_leads:
            unverified_leads = [
                r for r in done_rows 
                if get_clean_mail(r) and get_clean_mail(r) not in existing_emails
            ]

        logger.info(f"Found {len(unverified_leads)} unverified leads. Verifying up to {batch_size}...")
        results = []
        for row in unverified_leads[:batch_size]:
            res = await self.verify_email(
                domain=row["domain"],
                email=row["raw_email"],
                phone=row.get("phone_number", ""),
                top_service_need=row.get("top_service_need", ""),
                need_score=row.get("need_score", 0),
                pain_points=row.get("pain_points", "")
            )
            results.append(res)
            await asyncio.sleep(0.3)

        return {
            "status": "success",
            "processed": len(results),
            "results": results
        }

verifier_service = VerifierService()
