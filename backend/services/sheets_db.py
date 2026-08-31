import os
import time
import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import gspread
from google.oauth2.service_account import Credentials

try:
    from backend.config import settings, get_service_account_path
except ImportError:
    from config import settings, get_service_account_path

logger = logging.getLogger("SheetsDB")

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

SHEET_RAW = "Raw_Scraped_Domains"
SHEET_VERIFIED = "Verified_Outreach_Queue"
SHEET_KEYS = "API_Keys_Pool"

RAW_HEADERS = [
    "Domain", 
    "Company Name", 
    "Scraped Emails", 
    "Phone Number", 
    "Top Service Need", 
    "Need Score", 
    "Pain Points", 
    "Scrape Status", 
    "Scraped Date"
]

VERIFIED_HEADERS = [
    "Domain", 
    "Decision Maker Email", 
    "Phone Number", 
    "Deliverability Score", 
    "Top Service Need", 
    "Need Score", 
    "Pain Points", 
    "Outreach Status", 
    "Sent Timestamp"
]

KEYS_HEADERS = ["Provider", "Email Account", "API Key", "Key Type", "Status", "Calls Made"]

CACHE_TTL_SECONDS = 6.0

class SheetsDB:
    def __init__(self):
        self.client: Optional[gspread.Client] = None
        self.spreadsheet: Optional[gspread.Spreadsheet] = None
        self._lock: Optional[asyncio.Lock] = None
        self._initialized = False

    @property
    def lock(self) -> asyncio.Lock:
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock

        # In-memory fast cache to avoid hitting Google Sheets 60 req/min quota
        self._raw_cache: List[Dict[str, Any]] = []
        self._raw_cache_ts: float = 0.0

        self._verified_cache: List[Dict[str, Any]] = []
        self._verified_cache_ts: float = 0.0

        self._keys_cache: List[Dict[str, Any]] = []
        self._keys_cache_ts: float = 0.0

    def _get_client(self) -> Optional[gspread.Client]:
        raw_val = (settings.GOOGLE_SERVICE_ACCOUNT_JSON or "").strip()
        
        # Strip surrounding quotes if wrapped
        if (raw_val.startswith('"') and raw_val.endswith('"')) or (raw_val.startswith("'") and raw_val.endswith("'")):
            raw_val = raw_val[1:-1].strip()
            
        if "{" in raw_val and "}" in raw_val:
            try:
                import json
                start_idx = raw_val.find("{")
                end_idx = raw_val.rfind("}") + 1
                json_str = raw_val[start_idx:end_idx]
                info = json.loads(json_str)
                if "private_key" in info and isinstance(info["private_key"], str):
                    info["private_key"] = info["private_key"].replace("\\n", "\n")
                creds = Credentials.from_service_account_info(info, scopes=SCOPES)
                return gspread.authorize(creds)
            except Exception as e:
                logger.warning(f"Failed parsing raw service account JSON: {e}")
        
        try:
            creds_path = get_service_account_path()
            if os.path.exists(creds_path):
                creds = Credentials.from_service_account_file(creds_path, scopes=SCOPES)
                return gspread.authorize(creds)
        except Exception as e:
            logger.warning(f"Failed loading service account file: {e}")
            
        logger.error("No valid Google Service Account credentials available.")
        return None

    async def initialize(self):
        async with self.lock:
            if self._initialized:
                return
            try:
                loop = asyncio.get_event_loop()
                client = await loop.run_in_executor(None, self._get_client)
                if client is None:
                    logger.warning("Google Sheets client is None. Running in offline/fallback mode.")
                    self._initialized = True
                    return
                self.client = client
                self.spreadsheet = await loop.run_in_executor(
                    None, lambda: self.client.open_by_key(settings.GOOGLE_SHEET_ID)
                )
                logger.info(f"Connected to Google Sheet: {self.spreadsheet.title}")

                # Ensure all 3 worksheets exist with headers
                await loop.run_in_executor(None, self._ensure_worksheets_and_seed)
                self._initialized = True
            except Exception as e:
                logger.error(f"Failed to initialize Google Sheets DB: {e}")
                self._initialized = True

    def _ensure_worksheets_and_seed(self):
        try:
            existing_sheets = {ws.title: ws for ws in self.spreadsheet.worksheets()}

            # 1. Raw Scraped Domains
            if SHEET_RAW not in existing_sheets:
                ws = self.spreadsheet.add_worksheet(title=SHEET_RAW, rows=2000, cols=12)
                ws.append_row(RAW_HEADERS)
                logger.info(f"Created worksheet: {SHEET_RAW}")
            else:
                ws = existing_sheets[SHEET_RAW]
                headers = ws.row_values(1)
                if not headers or len(headers) < len(RAW_HEADERS):
                    ws.update("A1:I1", [RAW_HEADERS])

            # 2. Verified Outreach Queue
            if SHEET_VERIFIED not in existing_sheets:
                ws = self.spreadsheet.add_worksheet(title=SHEET_VERIFIED, rows=2000, cols=12)
                ws.append_row(VERIFIED_HEADERS)
                logger.info(f"Created worksheet: {SHEET_VERIFIED}")
            else:
                ws = existing_sheets[SHEET_VERIFIED]
                headers = ws.row_values(1)
                if not headers or len(headers) < len(VERIFIED_HEADERS):
                    ws.update("A1:I1", [VERIFIED_HEADERS])

            # 3. API Keys Pool
            if SHEET_KEYS not in existing_sheets:
                ws = self.spreadsheet.add_worksheet(title=SHEET_KEYS, rows=100, cols=10)
                ws.append_row(KEYS_HEADERS)
                self._seed_default_keys(ws)
                logger.info(f"Created and seeded worksheet: {SHEET_KEYS}")
            else:
                ws = existing_sheets[SHEET_KEYS]
                all_vals = ws.get_all_values()
                if not all_vals or len(all_vals) <= 1:
                    if not all_vals:
                        ws.append_row(KEYS_HEADERS)
                    self._seed_default_keys(ws)
        except Exception as e:
            logger.warning(f"Warning during worksheet check: {e}")

    def _seed_default_keys(self, ws: gspread.Worksheet):
        initial_keys = []
        if settings.HUNTER_API_KEY:
            initial_keys.append(["hunter", "default@hunter.io", settings.HUNTER_API_KEY, "FREE", "ACTIVE", 0])
        if settings.TOMBA_API_KEY:
            initial_keys.append(["tomba", "default@tomba.io", settings.TOMBA_API_KEY, "FREE", "ACTIVE", 0])
        if settings.APILAYER_API_KEY:
            initial_keys.append(["apilayer", "default@apilayer.com", settings.APILAYER_API_KEY, "FREE", "ACTIVE", 0])
        if settings.BREVO_API_KEY:
            initial_keys.append(["brevo", settings.BREVO_SENDER_EMAIL, settings.BREVO_API_KEY, "FREE", "ACTIVE", 0])
        if settings.DOMAINSDB_API_KEY:
            initial_keys.append(["domainsdb", "default@domainsdb.info", settings.DOMAINSDB_API_KEY, "FREE", "ACTIVE", 0])

        if initial_keys:
            ws.append_rows(initial_keys)
            logger.info(f"Seeded {len(initial_keys)} default API keys into {SHEET_KEYS}")

    # ================= Stage 1: Raw Scraped Domains =================
    async def get_raw_domains(self, status: Optional[str] = None, force_fresh: bool = False) -> List[Dict[str, Any]]:
        now = time.time()
        if not force_fresh and self._raw_cache and (now - self._raw_cache_ts < CACHE_TTL_SECONDS):
            if status is None:
                return list(self._raw_cache)
            return [r for r in self._raw_cache if r.get("scrape_status") == status.upper()]

        await self.initialize()
        async with self.lock:
            loop = asyncio.get_event_loop()
            try:
                ws = await loop.run_in_executor(None, lambda: self.spreadsheet.worksheet(SHEET_RAW))
                all_values = await loop.run_in_executor(None, ws.get_all_values)
                
                results = []
                if len(all_values) > 1:
                    for idx, row in enumerate(all_values[1:], start=2):
                        if not row or not row[0].strip():
                            continue
                        
                        domain = row[0].strip() if len(row) > 0 else ""
                        company_name = row[1].strip() if len(row) > 1 else ""
                        raw_email = row[2].strip() if len(row) > 2 else ""
                        phone_number = row[3].strip() if len(row) > 3 else ""

                        # If legacy row where column 4 is scrape_status (e.g. PENDING, DONE, REJECTED)
                        if len(row) < 9 or (len(row) > 4 and row[4].strip().upper() in ["PENDING", "DONE", "REJECTED"]):
                            top_service_need = ""
                            need_score = 0
                            pain_points = ""
                            scrape_status = row[4].strip().upper() if len(row) > 4 else "PENDING"
                            scraped_date = row[5].strip() if len(row) > 5 else ""
                        else:
                            top_service_need = row[4].strip() if len(row) > 4 else ""
                            need_score = int(row[5]) if len(row) > 5 and row[5].isdigit() else 0
                            pain_points = row[6].strip() if len(row) > 6 else ""
                            scrape_status = row[7].strip().upper() if len(row) > 7 else "PENDING"
                            scraped_date = row[8].strip() if len(row) > 8 else ""

                        results.append({
                            "row_index": idx,
                            "domain": domain,
                            "company_name": company_name,
                            "raw_email": raw_email,
                            "phone_number": phone_number,
                            "top_service_need": top_service_need,
                            "need_score": need_score,
                            "pain_points": pain_points,
                            "scrape_status": scrape_status,
                            "scraped_date": scraped_date,
                        })
                
                self._raw_cache = results
                self._raw_cache_ts = time.time()
            except Exception as e:
                logger.warning(f"Google Sheets rate limit / read error for {SHEET_RAW}: {e}. Serving from cache.")

            if status is None:
                return list(self._raw_cache)
            return [r for r in self._raw_cache if r.get("scrape_status") == status.upper()]

    async def add_raw_domains(self, domains_data: List[Dict[str, Any]]) -> int:
        if not domains_data:
            return 0
        await self.initialize()
        async with self.lock:
            loop = asyncio.get_event_loop()
            existing_domains = {r["domain"].lower() for r in self._raw_cache}

            new_rows = []
            now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
            start_row = len(self._raw_cache) + 2

            for d in domains_data:
                dom = str(d.get("domain", "")).strip().lower()
                if dom and dom not in existing_domains:
                    new_item = {
                        "row_index": start_row + len(new_rows),
                        "domain": d.get("domain", ""),
                        "company_name": d.get("company_name", ""),
                        "raw_email": d.get("raw_email", ""),
                        "phone_number": d.get("phone_number", ""),
                        "top_service_need": d.get("top_service_need", ""),
                        "need_score": d.get("need_score", 0),
                        "pain_points": d.get("pain_points", ""),
                        "scrape_status": d.get("scrape_status", "PENDING").upper(),
                        "scraped_date": d.get("scraped_date", now_str)
                    }
                    self._raw_cache.append(new_item)
                    existing_domains.add(dom)
                    new_rows.append([
                        new_item["domain"],
                        new_item["company_name"],
                        new_item["raw_email"],
                        new_item["phone_number"],
                        new_item["top_service_need"],
                        str(new_item["need_score"]),
                        new_item["pain_points"],
                        new_item["scrape_status"],
                        new_item["scraped_date"]
                    ])

            if new_rows:
                try:
                    ws = await loop.run_in_executor(None, lambda: self.spreadsheet.worksheet(SHEET_RAW))
                    await loop.run_in_executor(None, lambda: ws.append_rows(new_rows))
                    logger.info(f"Appended {len(new_rows)} new domains to {SHEET_RAW}")
                except Exception as e:
                    logger.warning(f"Warning syncing new rows to Google Sheets: {e}")
                return len(new_rows)
            return 0

    async def update_raw_domain(self, row_index: int, company_name: Optional[str] = None,
                                raw_email: Optional[str] = None, phone_number: Optional[str] = None,
                                top_service_need: Optional[str] = None, need_score: Optional[int] = None,
                                pain_points: Optional[str] = None, scrape_status: Optional[str] = None):
        # Update cache immediately
        for item in self._raw_cache:
            if item["row_index"] == row_index:
                if company_name is not None:
                    item["company_name"] = company_name
                if raw_email is not None:
                    item["raw_email"] = raw_email
                if phone_number is not None:
                    item["phone_number"] = phone_number
                if top_service_need is not None:
                    item["top_service_need"] = top_service_need
                if need_score is not None:
                    item["need_score"] = need_score
                if pain_points is not None:
                    item["pain_points"] = pain_points
                if scrape_status is not None:
                    item["scrape_status"] = scrape_status.upper()
                break

        await self.initialize()
        async with self.lock:
            loop = asyncio.get_event_loop()
            updates = []
            if company_name is not None:
                updates.append({"range": f"B{row_index}", "values": [[company_name]]})
            if raw_email is not None:
                updates.append({"range": f"C{row_index}", "values": [[raw_email]]})
            if phone_number is not None:
                updates.append({"range": f"D{row_index}", "values": [[phone_number]]})
            if top_service_need is not None:
                updates.append({"range": f"E{row_index}", "values": [[top_service_need]]})
            if need_score is not None:
                updates.append({"range": f"F{row_index}", "values": [[str(need_score)]]})
            if pain_points is not None:
                updates.append({"range": f"G{row_index}", "values": [[pain_points]]})
            if scrape_status is not None:
                updates.append({"range": f"H{row_index}", "values": [[scrape_status.upper()]]})

            if updates:
                try:
                    ws = await loop.run_in_executor(None, lambda: self.spreadsheet.worksheet(SHEET_RAW))
                    await loop.run_in_executor(None, lambda: ws.batch_update(updates))
                except Exception as e:
                    logger.warning(f"Warning updating raw domain row {row_index} in Google Sheets: {e}")

    async def delete_raw_domains(self, domains: List[str]) -> int:
        """
        Delete selected domains from Sheet 1 (Raw_Scraped_Domains) and update in-memory cache.
        """
        if not domains:
            return 0
        
        delete_set = {d.strip().lower() for d in domains}
        before_count = len(self._raw_cache)
        self._raw_cache = [item for item in self._raw_cache if item["domain"].strip().lower() not in delete_set]
        for idx, item in enumerate(self._raw_cache, start=2):
            item["row_index"] = idx
        self._raw_cache_ts = time.time()
        
        await self.initialize()
        async with self.lock:
            loop = asyncio.get_event_loop()
            try:
                ws = await loop.run_in_executor(None, lambda: self.spreadsheet.worksheet(SHEET_RAW))
                all_vals = await loop.run_in_executor(None, ws.get_all_values)
                headers = all_vals[0] if all_vals else RAW_HEADERS
                
                remaining_rows = []
                for r in all_vals[1:]:
                    if r and len(r) > 0 and r[0].strip().lower() not in delete_set:
                        remaining_rows.append(r)
                
                await loop.run_in_executor(None, ws.clear)
                await loop.run_in_executor(None, lambda: ws.update([headers] + remaining_rows))
                logger.info(f"Successfully deleted {len(domains)} domain(s) from {SHEET_RAW}")
                return before_count - len(self._raw_cache)
            except Exception as e:
                logger.error(f"Error deleting raw domains from Google Sheets: {e}")
                return 0

    # ================= Stage 3 & 4: Verified Outreach Queue =================
    async def get_verified_leads(self, status: Optional[str] = None, force_fresh: bool = False) -> List[Dict[str, Any]]:
        now = time.time()
        if not force_fresh and self._verified_cache and (now - self._verified_cache_ts < CACHE_TTL_SECONDS):
            if status is None:
                return list(self._verified_cache)
            return [r for r in self._verified_cache if r.get("outreach_status") == status.upper()]

        await self.initialize()
        async with self.lock:
            loop = asyncio.get_event_loop()
            try:
                ws = await loop.run_in_executor(None, lambda: self.spreadsheet.worksheet(SHEET_VERIFIED))
                all_values = await loop.run_in_executor(None, ws.get_all_values)
                
                results = []
                if len(all_values) > 1:
                    for idx, row in enumerate(all_values[1:], start=2):
                        if not row or not row[0].strip():
                            continue
                        
                        domain = row[0].strip() if len(row) > 0 else ""
                        decision_maker_email = row[1].strip() if len(row) > 1 else ""
                        phone_number = row[2].strip() if len(row) > 2 else ""
                        verification_score = row[3].strip() if len(row) > 3 else "0.95"

                        # If legacy row where column 4 is outreach_status (e.g. READY, SENT, BOUNCED)
                        if len(row) < 9 or (len(row) > 4 and row[4].strip().upper() in ["READY", "SENT", "BOUNCED"]):
                            top_service_need = ""
                            need_score = 0
                            pain_points = ""
                            outreach_status = row[4].strip().upper() if len(row) > 4 else "READY"
                            sent_timestamp = row[5].strip() if len(row) > 5 else ""
                        else:
                            top_service_need = row[4].strip() if len(row) > 4 else ""
                            need_score = int(row[5]) if len(row) > 5 and row[5].isdigit() else 0
                            pain_points = row[6].strip() if len(row) > 6 else ""
                            outreach_status = row[7].strip().upper() if len(row) > 7 else "READY"
                            sent_timestamp = row[8].strip() if len(row) > 8 else ""

                        results.append({
                            "row_index": idx,
                            "domain": domain,
                            "decision_maker_email": decision_maker_email,
                            "phone_number": phone_number,
                            "verification_score": verification_score,
                            "top_service_need": top_service_need,
                            "need_score": need_score,
                            "pain_points": pain_points,
                            "outreach_status": outreach_status,
                            "sent_timestamp": sent_timestamp,
                        })
                
                self._verified_cache = results
                self._verified_cache_ts = time.time()
            except Exception as e:
                logger.warning(f"Google Sheets rate limit / read error for {SHEET_VERIFIED}: {e}. Serving from cache.")

            if status is None:
                return list(self._verified_cache)
            return [r for r in self._verified_cache if r.get("outreach_status") == status.upper()]

    async def add_verified_lead(self, domain: str, email: str, phone: str, score: float,
                                top_service_need: str = "", need_score: int = 0, pain_points: str = "",
                                status: str = "READY", sent_time: str = "") -> bool:
        # Check cache duplicate
        existing_emails = {str(r.get("decision_maker_email", "")).lower() for r in self._verified_cache}
        if email.strip().lower() in existing_emails:
            return False

        new_row_idx = len(self._verified_cache) + 2
        item = {
            "row_index": new_row_idx,
            "domain": domain,
            "decision_maker_email": email,
            "phone_number": phone,
            "verification_score": f"{score:.2f}",
            "top_service_need": top_service_need,
            "need_score": need_score,
            "pain_points": pain_points,
            "outreach_status": status.upper(),
            "sent_timestamp": sent_time
        }
        self._verified_cache.append(item)

        await self.initialize()
        async with self.lock:
            loop = asyncio.get_event_loop()
            row = [
                domain, 
                email, 
                phone, 
                f"{score:.2f}", 
                top_service_need, 
                str(need_score), 
                pain_points, 
                status.upper(), 
                sent_time
            ]
            try:
                ws = await loop.run_in_executor(None, lambda: self.spreadsheet.worksheet(SHEET_VERIFIED))
                await loop.run_in_executor(None, lambda: ws.append_row(row))
                logger.info(f"Added verified lead {email} to {SHEET_VERIFIED}")
            except Exception as e:
                logger.warning(f"Warning writing verified lead to Google Sheets: {e}")
            return True

    async def update_verified_lead_status(self, row_index: int, status: str, sent_time: Optional[str] = None):
        # Update cache
        for item in self._verified_cache:
            if item["row_index"] == row_index:
                item["outreach_status"] = status.upper()
                if sent_time is not None:
                    item["sent_timestamp"] = sent_time
                break

        await self.initialize()
        async with self.lock:
            loop = asyncio.get_event_loop()
            updates = [{"range": f"H{row_index}", "values": [[status.upper()]]}]
            if sent_time is not None:
                updates.append({"range": f"I{row_index}", "values": [[sent_time]]})

            try:
                ws = await loop.run_in_executor(None, lambda: self.spreadsheet.worksheet(SHEET_VERIFIED))
                await loop.run_in_executor(None, lambda: ws.batch_update(updates))
            except Exception as e:
                logger.warning(f"Warning updating verified lead in Google Sheets: {e}")

    async def delete_verified_leads(self, emails: List[str], domains: Optional[List[str]] = None) -> int:
        """
        Delete selected leads from Sheet 2 (Verified_Outreach_Queue) and update in-memory cache.
        """
        if not emails and not domains:
            return 0
        
        email_delete_set = {e.strip().lower() for e in (emails or [])}
        domain_delete_set = {d.strip().lower() for d in (domains or [])}
        
        before_count = len(self._verified_cache)
        self._verified_cache = [
            item for item in self._verified_cache 
            if item["decision_maker_email"].strip().lower() not in email_delete_set
            and item["domain"].strip().lower() not in domain_delete_set
        ]
        for idx, item in enumerate(self._verified_cache, start=2):
            item["row_index"] = idx
        self._verified_cache_ts = time.time()
        
        await self.initialize()
        async with self.lock:
            loop = asyncio.get_event_loop()
            try:
                ws = await loop.run_in_executor(None, lambda: self.spreadsheet.worksheet(SHEET_VERIFIED))
                all_vals = await loop.run_in_executor(None, ws.get_all_values)
                headers = all_vals[0] if all_vals else VERIFIED_HEADERS
                
                remaining_rows = []
                for r in all_vals[1:]:
                    if r and len(r) > 1:
                        dom = r[0].strip().lower()
                        mail = r[1].strip().lower()
                        if mail not in email_delete_set and dom not in domain_delete_set:
                            remaining_rows.append(r)
                
                await loop.run_in_executor(None, ws.clear)
                await loop.run_in_executor(None, lambda: ws.update([headers] + remaining_rows))
                logger.info(f"Successfully deleted leads from {SHEET_VERIFIED}")
                return before_count - len(self._verified_cache)
            except Exception as e:
                logger.error(f"Error deleting verified leads from Google Sheets: {e}")
                return 0

    # ================= Sheet 3: API Keys Pool =================
    async def get_api_keys(self, provider: Optional[str] = None, force_fresh: bool = False) -> List[Dict[str, Any]]:
        now = time.time()
        if not force_fresh and self._keys_cache and (now - self._keys_cache_ts < CACHE_TTL_SECONDS):
            if provider is None:
                return list(self._keys_cache)
            return [k for k in self._keys_cache if k.get("provider") == provider.lower()]

        await self.initialize()
        async with self.lock:
            loop = asyncio.get_event_loop()
            try:
                ws = await loop.run_in_executor(None, lambda: self.spreadsheet.worksheet(SHEET_KEYS))
                rows = await loop.run_in_executor(None, ws.get_all_records)
                
                results = []
                for idx, r in enumerate(rows, start=2):
                    item = {
                        "row_index": idx,
                        "provider": str(r.get("Provider", "")).strip().lower(),
                        "email_account": str(r.get("Email Account", "")).strip(),
                        "api_key": str(r.get("API Key", "")).strip(),
                        "key_type": str(r.get("Key Type", "FREE")).strip().upper(),
                        "status": str(r.get("Status", "ACTIVE")).strip().upper(),
                        "calls_made": int(r.get("Calls Made", 0) or 0),
                    }
                    results.append(item)
                
                self._keys_cache = results
                self._keys_cache_ts = time.time()
            except Exception as e:
                logger.warning(f"Google Sheets rate limit / read error for {SHEET_KEYS}: {e}. Serving from cache.")

            if provider is None:
                return list(self._keys_cache)
            return [k for k in self._keys_cache if k.get("provider") == provider.lower()]

    async def update_key_usage(self, row_index: int, calls_made: int, status: str = "ACTIVE"):
        for item in self._keys_cache:
            if item["row_index"] == row_index:
                item["calls_made"] = calls_made
                item["status"] = status.upper()
                break

        await self.initialize()
        async with self.lock:
            loop = asyncio.get_event_loop()
            updates = [
                {"range": f"E{row_index}", "values": [[status.upper()]]},
                {"range": f"F{row_index}", "values": [[calls_made]]}
            ]
            try:
                ws = await loop.run_in_executor(None, lambda: self.spreadsheet.worksheet(SHEET_KEYS))
                await loop.run_in_executor(None, lambda: ws.batch_update(updates))
            except Exception as e:
                logger.warning(f"Warning updating API key in Google Sheets: {e}")

    async def increment_key_calls(self, row_index: int, current_calls: int):
        await self.update_key_usage(row_index, current_calls + 1)

    async def update_key_status(self, row_index: int, status: str):
        for item in self._keys_cache:
            if item["row_index"] == row_index:
                item["status"] = status.upper()
                await self.update_key_usage(row_index, item.get("calls_made", 0), status)
                break

    async def inject_api_key(self, provider: str, email: str, key: str, key_type: str = "FREE") -> bool:
        return await self.add_api_key(provider=provider, email_account=email, api_key=key, key_type=key_type, status="ACTIVE")

    async def add_api_key(self, provider: str, email_account: str, api_key: str, key_type: str = "FREE", status: str = "ACTIVE") -> bool:
        new_row_idx = len(self._keys_cache) + 2
        item = {
            "row_index": new_row_idx,
            "provider": provider.lower(),
            "email_account": email_account,
            "api_key": api_key,
            "key_type": key_type.upper(),
            "status": status.upper(),
            "calls_made": 0
        }
        self._keys_cache.append(item)
        await self.initialize()
        async with self.lock:
            loop = asyncio.get_event_loop()
            try:
                ws = await loop.run_in_executor(None, lambda: self.spreadsheet.worksheet(SHEET_KEYS))
                await loop.run_in_executor(None, lambda: ws.append_row([provider.lower(), email_account, api_key, key_type.upper(), status.upper(), 0]))
                return True
            except Exception as e:
                logger.warning(f"Warning injecting API key to Google Sheets: {e}")
                return False

db = SheetsDB()

