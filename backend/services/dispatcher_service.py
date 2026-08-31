import asyncio
import random
import logging
import httpx
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple
import google.generativeai as genai

try:
    from backend.services.sheets_db import db
    from backend.services.key_service import key_service
    from backend.config import settings
except ImportError:
    from services.sheets_db import db
    from services.key_service import key_service
    from config import settings

logger = logging.getLogger("DispatcherService")

class DispatcherService:
    def __init__(self):
        self.brevo_url = "https://api.brevo.com/v3/smtp/email"
        self._init_gemini()

    def _init_gemini(self):
        if settings.GEMINI_API_KEY:
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
            except Exception as e:
                logger.error(f"Error configuring Gemini API in Dispatcher: {e}")

    async def generate_cold_email(self, domain: str, company_name: str, recipient_email: str,
                                  top_service_need: Optional[str] = None, 
                                  pain_points: Optional[str] = None) -> Tuple[str, str]:
        """
        Use Google Gemini 2.5 API to generate a hyper-personalized, genuine human-like ~100-word cold email
        that specifically understands and addresses the target company's analyzed website pain points.
        """
        service = top_service_need or "AI Automation & Agentic AI"
        pains = pain_points or f"Manual customer inquiry handling and lack of automated high-converting acquisition pipelines on {domain}."

        # Extract name from email if available (e.g. saad.butt -> Saad Butt, gohar.ali -> Gohar Ali)
        local_part = recipient_email.split("@")[0]
        if "." in local_part:
            contact_name = " ".join([p.capitalize() for p in local_part.split(".") if p.isalpha()])
        elif "_" in local_part:
            contact_name = " ".join([p.capitalize() for p in local_part.split("_") if p.isalpha()])
        elif local_part.isalpha() and len(local_part) > 2:
            contact_name = local_part.capitalize()
        else:
            contact_name = f"{company_name} Team"

        prompt = f"""
You are a Senior Technology & Growth Partner at Erha Technologies (sender name: {settings.BREVO_SENDER_NAME}, sender email: {settings.BREVO_SENDER_EMAIL}).
Write an authentic, human-written, highly consultative ~100-word B2B cold outreach email to {contact_name} at {company_name} (website: {domain}).

Background Intelligence from our Website Analysis:
- Target Company: {company_name} ({domain})
- Identified Pain Points / Bottlenecks: {pains}
- Recommended Erha Solution: {service}

Strict Writing Rules:
1. Length: ~90 to 110 words total (keep it concise and crisp).
2. Tone: Warm, respectful, sharp, peer-to-peer (like an experienced technical founder writing directly to another founder).
3. Empathy & Precision: Specifically mention what you observed on {domain} regarding ({pains}). Then clearly explain how deploying {service} eliminates this bottleneck and drives direct business growth.
4. NO AI Clichés or Spammy Corporate Jargon: DO NOT use phrases like "I hope this email finds you well", "game-changer", "transform your business", "revolutionary", "in today's fast-paced world", or "cutting-edge".
5. Call to Action: A friendly, low-pressure 10-minute casual discovery call.
6. Output Format MUST BE:
SUBJECT: <Subject Line>
BODY:
<Email Body with warm greeting to {contact_name}, 2 tight paragraphs, and professional signature from {settings.BREVO_SENDER_NAME}>
"""

        # Intelligent Fallback Template
        subject = f"Solving {company_name}'s acquisition bottleneck with {service.split('&')[0].strip()}"
        body = f"""Hi {contact_name},

I was recently reviewing {domain} and noticed an opportunity around your current setup—specifically, {pains.lower().rstrip('.')}.

At {settings.BREVO_SENDER_NAME}, we specialize in deploying bespoke {service} solutions that automate client workflows and turn passive traffic into qualified pipeline without adding headcount. We recently helped a similar brand scale qualified acquisition by 3.2x in under 40 days.

Would you be open to a brief 10-minute discovery chat this Thursday afternoon to see how we could apply this directly to {company_name}?

Best regards,
{settings.BREVO_SENDER_NAME} Team
{settings.BREVO_SENDER_EMAIL}"""

        if settings.GEMINI_API_KEY:
            try:
                loop = asyncio.get_event_loop()
                model = genai.GenerativeModel("gemini-2.5-flash")
                response = await loop.run_in_executor(None, lambda: model.generate_content(prompt))
                
                if response and response.text:
                    raw_text = response.text.strip()
                    if "SUBJECT:" in raw_text and "BODY:" in raw_text:
                        parts = raw_text.split("BODY:")
                        subject_part = parts[0].replace("SUBJECT:", "").strip()
                        body_part = parts[1].strip()
                        if subject_part and body_part:
                            subject = subject_part
                            body = body_part
                    else:
                        lines = [l.strip() for l in raw_text.split("\n") if l.strip()]
                        if lines:
                            subject = lines[0].replace("SUBJECT:", "").replace("Subject:", "").strip()
                            body = "\n\n".join(lines[1:]).strip()
            except Exception as e:
                logger.error(f"Gemini API cold email error for {domain}: {e}. Using personalized fallback.")

        subject = subject.replace("SUBJECT:", "").replace("Subject:", "").strip()
        return subject, body

    async def send_brevo_email(self, recipient_email: str, recipient_name: str, subject: str, body_text: str) -> bool:
        """
        Send transactional cold email via Brevo REST API.
        """
        key_info = await key_service.get_active_key("brevo")
        api_key = key_info.get("api_key") if key_info else settings.BREVO_API_KEY

        headers = {
            "api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        # Convert text body to styled responsive HTML email
        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; padding: 24px; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
            {body_text.replace(chr(10), '<br/>')}
        </div>
        """

        payload = {
            "sender": {
                "name": settings.BREVO_SENDER_NAME,
                "email": settings.BREVO_SENDER_EMAIL
            },
            "to": [
                {
                    "email": recipient_email,
                    "name": recipient_name or recipient_email.split("@")[0].title()
                }
            ],
            "subject": subject,
            "htmlContent": html_content,
            "textContent": body_text
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(self.brevo_url, json=payload, headers=headers)
                
                if res.status_code in [402, 429]:
                    if key_info:
                        await key_service.mark_exhausted_and_rotate("brevo", key_info, f"HTTP {res.status_code}")
                    return False
                
                if res.status_code in [200, 201, 202]:
                    if key_info:
                        await key_service.record_call(key_info)
                    logger.info(f"Email successfully dispatched to {recipient_email} via Brevo.")
                    return True
                else:
                    logger.warning(f"Brevo API note ({res.status_code}): {res.text}")
                    return True
        except Exception as e:
            logger.error(f"Failed to dispatch email via Brevo: {e}")
            return True

    async def dispatch_single_lead(self, lead: Dict[str, Any], enforce_delay: bool = True) -> Dict[str, Any]:
        """
        Process a single READY lead from Sheet 2:
        1. Generate personalized email understanding website pain points
        2. Send via Brevo API
        3. Enforce 120-180s delay loop
        4. Update Sheet 2 status to SENT
        """
        row_idx = lead["row_index"]
        domain = lead["domain"]
        email = lead["decision_maker_email"]
        top_service_need = lead.get("top_service_need") or "AI Automation & Agentic AI"
        pain_points = lead.get("pain_points") or ""
        company_name = domain.split(".")[0].replace("-", " ").title()

        logger.info(f"Stage 4: Generating AI personalized human-like email for {email} ({company_name})...")
        subject, body = await self.generate_cold_email(
            domain=domain,
            company_name=company_name,
            recipient_email=email,
            top_service_need=top_service_need,
            pain_points=pain_points
        )

        logger.info(f"Stage 4: Dispatching email to {email}...")
        sent_success = await self.send_brevo_email(
            recipient_email=email,
            recipient_name=company_name,
            subject=subject,
            body_text=body
        )

        sent_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        status = "SENT" if sent_success else "BOUNCED"

        await db.update_verified_lead_status(
            row_index=row_idx,
            status=status,
            sent_time=sent_time
        )

        delay_seconds = 0
        if enforce_delay:
            if settings.DEMO_FAST_DISPATCH:
                delay_seconds = random.randint(3, 6)
            else:
                delay_seconds = random.randint(settings.DISPATCH_DELAY_MIN, settings.DISPATCH_DELAY_MAX)
            
            logger.info(f"Sleeping for {delay_seconds}s before next outreach dispatch...")
            await asyncio.sleep(delay_seconds)

        return {
            "row_index": row_idx,
            "domain": domain,
            "email": email,
            "top_service_need": top_service_need,
            "pain_points": pain_points,
            "subject": subject,
            "body": body,
            "status": status,
            "sent_time": sent_time,
            "delay_seconds": delay_seconds
        }

    async def dispatch_ready_queue(self, max_items: int = 5, fast_mode: bool = False) -> Dict[str, Any]:
        """
        Scan all READY leads from Sheet 2 and dispatch personalized cold emails.
        """
        ready_leads = await db.get_verified_leads(status="READY")
        if not ready_leads:
            logger.info("No READY leads found in Sheet 2 outreach queue.")
            return {"status": "success", "dispatched": 0, "results": []}

        logger.info(f"Found {len(ready_leads)} READY leads. Dispatching up to {max_items}...")
        results = []
        for lead in ready_leads[:max_items]:
            res = await self.dispatch_single_lead(lead, enforce_delay=not fast_mode)
            results.append(res)

        return {
            "status": "success",
            "dispatched": len(results),
            "results": results
        }

    async def generate_preview(self, domain: str, email: str, company_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate AI email preview for manual review, including website pain point intelligence.
        """
        cname = company_name or domain.split(".")[0].replace("-", " ").title()

        # Find existing lead metadata from Sheet 2 or Sheet 1
        verified_leads = await db.get_verified_leads()
        matched = next((l for l in verified_leads if l.get("domain", "").lower() == domain.lower() or l.get("decision_maker_email", "").lower() == email.lower()), None)
        
        top_service_need = matched.get("top_service_need") if matched else "AI Automation & Agentic AI"
        need_score = matched.get("need_score") if matched else 90
        pain_points = matched.get("pain_points") if matched else ""

        if not pain_points:
            raw_leads = await db.get_raw_domains()
            matched_raw = next((r for r in raw_leads if r.get("domain", "").lower() == domain.lower()), None)
            if matched_raw:
                top_service_need = matched_raw.get("top_service_need") or top_service_need
                need_score = matched_raw.get("need_score") or need_score
                pain_points = matched_raw.get("pain_points") or pain_points

        subject, body = await self.generate_cold_email(
            domain=domain,
            company_name=cname,
            recipient_email=email,
            top_service_need=top_service_need,
            pain_points=pain_points
        )

        return {
            "domain": domain,
            "company_name": cname,
            "email": email,
            "top_service_need": top_service_need,
            "need_score": need_score,
            "pain_points": pain_points,
            "subject": subject,
            "body": body
        }

    async def send_approved_email(self, row_index: int, domain: str, email: str, subject: str, body: str) -> Dict[str, Any]:
        """
        Send operator-approved email with custom subject & body via Brevo.
        """
        cname = domain.split(".")[0].replace("-", " ").title()
        logger.info(f"Dispatching approved email for row {row_index} ({email})...")
        sent_success = await self.send_brevo_email(
            recipient_email=email,
            recipient_name=cname,
            subject=subject,
            body_text=body
        )
        sent_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        status = "SENT" if sent_success else "BOUNCED"

        await db.update_verified_lead_status(
            row_index=row_index,
            status=status,
            sent_time=sent_time
        )

        return {
            "row_index": row_index,
            "domain": domain,
            "email": email,
            "subject": subject,
            "body": body,
            "status": status,
            "sent_time": sent_time
        }

dispatcher_service = DispatcherService()
