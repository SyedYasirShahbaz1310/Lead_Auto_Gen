import asyncio
import re
import json
import logging
import httpx
from bs4 import BeautifulSoup
from typing import Dict, Any, Optional, List, Tuple, Set
import google.generativeai as genai

try:
    from backend.services.sheets_db import db
    from backend.services.key_service import key_service
    from backend.config import settings
except ImportError:
    from services.sheets_db import db
    from services.key_service import key_service
    from config import settings

logger = logging.getLogger("ScraperService")

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
PHONE_REGEX = re.compile(r"(?:\+?\d{1,4}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}")

INVALID_EMAIL_EXTS = {".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif", ".css", ".js", "example.com", "domain.com", "sentry.io", "wixpress.com"}

SERVICES_LIST = [
    "AI Automation & Agentic AI",
    "Modern Web & Full-Stack Development",
    "Technical SEO & Growth Marketing",
    "Machine Learning & Predictive Systems",
    "Workflow & Business Process Automation"
]

class ScraperService:
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
        self._init_gemini()

    def _init_gemini(self):
        if settings.GEMINI_API_KEY:
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
            except Exception as e:
                logger.error(f"Error configuring Gemini API in Scraper: {e}")

    async def _crawl_website(self, domain: str) -> Tuple[List[str], List[str], Dict[str, Any]]:
        """
        Directly scrape domain homepage and subpages to extract:
        1. ALL genuine emails
        2. Real phone numbers
        3. Website textual & structural metadata for AI Niche & Pain Point Analysis
        """
        clean_domain = domain.strip().replace(" ", "").lower()
        urls_to_try = [
            f"https://{clean_domain}",
            f"https://www.{clean_domain}",
            f"https://{clean_domain}/contact",
            f"https://{clean_domain}/about"
        ]

        found_emails: Set[str] = set()
        found_phones: Set[str] = set()
        site_context = {
            "title": "",
            "description": "",
            "keywords": "",
            "headings": [],
            "content_snippet": "",
            "has_ssl": True,
            "tech_signals": []
        }

        async def fetch_url(client: httpx.AsyncClient, url: str) -> Optional[str]:
            try:
                res = await client.get(url, headers=self.headers, timeout=4.5)
                if res.status_code == 200:
                    return res.text
            except Exception:
                pass
            return None

        async with httpx.AsyncClient(follow_redirects=True, verify=False) as client:
            responses = await asyncio.gather(*[fetch_url(client, u) for u in urls_to_try], return_exceptions=True)
            for text in responses:
                if not text or not isinstance(text, str):
                    continue
                try:
                    soup = BeautifulSoup(text, "html.parser")

                    # Extract Title
                    if not site_context["title"] and soup.title and soup.title.string:
                        site_context["title"] = soup.title.string.strip()

                    # Extract Meta Description & OpenGraph
                    if not site_context["description"]:
                        meta_desc = soup.find("meta", attrs={"name": re.compile(r"description", re.I)}) or \
                                    soup.find("meta", attrs={"property": re.compile(r"og:description", re.I)})
                        if meta_desc and meta_desc.get("content"):
                            site_context["description"] = meta_desc.get("content").strip()

                    if not site_context["keywords"]:
                        meta_kw = soup.find("meta", attrs={"name": re.compile(r"keywords", re.I)})
                        if meta_kw and meta_kw.get("content"):
                            site_context["keywords"] = meta_kw.get("content").strip()

                    # Collect headings
                    for h in soup.find_all(["h1", "h2", "h3"])[:8]:
                        h_txt = h.get_text(strip=True)
                        if h_txt and len(h_txt) > 4 and h_txt not in site_context["headings"]:
                            site_context["headings"].append(h_txt)

                    # Collect rich text snippet for business intelligence
                    if not site_context["content_snippet"]:
                        paragraphs = [p.get_text(strip=True) for p in soup.find_all(["p", "li", "span"]) if len(p.get_text(strip=True)) > 20]
                        cleaned_snippet = " ".join(paragraphs[:8])
                        site_context["content_snippet"] = cleaned_snippet[:1200]

                    # Detect tech signals
                    lower_text = text.lower()
                    if "wp-content" in lower_text or "wordpress" in lower_text:
                        site_context["tech_signals"].append("WordPress")
                    if "shopify" in lower_text or "cdn.shopify.com" in lower_text:
                        site_context["tech_signals"].append("Shopify")
                    if "woocommerce" in lower_text:
                        site_context["tech_signals"].append("WooCommerce")
                    if "magento" in lower_text:
                        site_context["tech_signals"].append("Magento")
                    if "webflow" in lower_text:
                        site_context["tech_signals"].append("Webflow")
                    if "wix" in lower_text:
                        site_context["tech_signals"].append("Wix")
                    if "squarespace" in lower_text:
                        site_context["tech_signals"].append("Squarespace")
                    if "_next" in lower_text or "next.js" in lower_text:
                        site_context["tech_signals"].append("Next.js")
                    if "react" in lower_text:
                        site_context["tech_signals"].append("React")
                    if "hubspot" in lower_text:
                        site_context["tech_signals"].append("HubSpot")
                    if "stripe" in lower_text:
                        site_context["tech_signals"].append("Stripe Checkout")

                    # 1. Search mailto links
                    for a in soup.find_all("a", href=True):
                        href = a["href"].strip()
                        if href.startswith("mailto:"):
                            mail = href.replace("mailto:", "").split("?")[0].strip().lower()
                            if EMAIL_REGEX.match(mail) and not any(ext in mail for ext in INVALID_EMAIL_EXTS):
                                found_emails.add(mail)
                        elif href.startswith("tel:"):
                            phone = href.replace("tel:", "").split("?")[0].strip()
                            if len(re.sub(r"\D", "", phone)) >= 7:
                                found_phones.add(phone)

                    # 2. Regex search across entire page body
                    matches = EMAIL_REGEX.findall(text)
                    for m in matches:
                        m_clean = m.strip().lower()
                        if not any(ext in m_clean for ext in INVALID_EMAIL_EXTS):
                            found_emails.add(m_clean)

                    # 3. Search phone numbers in contact sections
                    for tag in soup.find_all(["p", "span", "div", "a", "li", "footer"]):
                        tag_text = tag.get_text(strip=True)
                        if any(k in tag_text.lower() for k in ["phone", "tel", "call", "whatsapp", "contact", "+"]):
                            phone_matches = PHONE_REGEX.findall(tag_text)
                            for p in phone_matches:
                                digits = re.sub(r"\D", "", p)
                                if 7 <= len(digits) <= 15:
                                    found_phones.add(p.strip())
                except Exception:
                    continue

        return list(found_emails), list(found_phones), site_context

    def _detect_niche_fallback(self, domain: str, title: str, desc: str, snippet: str) -> str:
        combined = f"{domain} {title} {desc} {snippet}".lower()
        if any(k in combined for k in ["real estate", "property", "realtor", "homes", "estates", "apartments", "housing", "rent", "mortgage", "brokerage", "zameen"]):
            return "Real Estate & Property Portals"
        if any(k in combined for k in ["apparel", "clothing", "fashion", "boutique", "shoes", "wear", "jewelry", "ecommerce", "shop", "store", "cart", "outfit", "daraz", "brand", "order"]):
            return "E-Commerce, Fashion & Retail"
        if any(k in combined for k in ["health", "medical", "clinic", "dental", "pharma", "care", "wellness", "doctor", "hospital", "patient", "therapy", "physician"]):
            return "Healthcare & Medical Services"
        if any(k in combined for k in ["saas", "software", "tech", "cloud", "ai", "cyber", "data", "platform", "api", "analytics", "it solutions", "devops", "automation"]):
            return "B2B SaaS & Tech Platforms"
        if any(k in combined for k in ["marketing", "growth agency", "seo", "media", "creative", "branding", "advertising", "content creation", "digital marketing"]):
            return "Digital Marketing & Creative Agency"
        if any(k in combined for k in ["finance", "fintech", "accounting", "capital", "invest", "crypto", "banking", "wealth", "tax", "insurance", "loan"]):
            return "Finance, Fintech & Wealth Advisory"
        if any(k in combined for k in ["logistics", "freight", "supply chain", "shipping", "transport", "warehouse", "delivery", "cargo"]):
            return "Logistics, Freight & Supply Chain"
        if any(k in combined for k in ["food", "restaurant", "cafe", "coffee", "roaster", "bakery", "dining", "culinary", "bistro", "catering"]):
            return "Food, Dining & Hospitality"
        if any(k in combined for k in ["law", "legal", "attorney", "lawyer", "advocate", "litigation", "solicitor", "counsel"]):
            return "Legal & Professional Advisory"
        if any(k in combined for k in ["construction", "builder", "architect", "engineering", "contractor", "industrial", "solar", "energy", "manufacturing"]):
            return "Construction, Engineering & Industrial"
        if any(k in combined for k in ["education", "academy", "course", "school", "learning", "tutor", "training", "university", "college", "edtech"]):
            return "Education & EdTech"
        if any(k in combined for k in ["auto", "car", "dealership", "vehicle", "motors", "repair", "tires", "parts"]):
            return "Automotive & Dealerships"
        if any(k in combined for k in ["travel", "tourism", "hotel", "resort", "booking", "tour", "vacation", "flight"]):
            return "Travel & Tourism"
        if any(k in combined for k in ["beauty", "cosmetics", "skincare", "salon", "spa", "hair", "aesthetics"]):
            return "Beauty & Personal Care"
        return "Commercial Business & Digital Services"

    async def _analyze_website_pain_points(self, domain: str, company_name: str, site_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Use Google Gemini 2.5 Flash AI to analyze website copy & structure, detect exact business niche/industry,
        identify genuine operational pain points, determine Erha Technologies top service match, and compute Need Score.
        """
        title = site_context.get("title", "")
        desc = site_context.get("description", "")
        keywords = site_context.get("keywords", "")
        headings = " | ".join(site_context.get("headings", []))
        snippet = site_context.get("content_snippet", "")
        tech = ", ".join(set(site_context.get("tech_signals", []))) or "Standard Web Stack"

        niche_fallback = self._detect_niche_fallback(domain, title, desc, snippet)

        prompt = f"""
You are an expert Solutions Architect at Erha Technologies (a premier AI, Full-Stack Software & Digital Growth Consultancy).
Analyze this target company website profile deeply:
- Domain: {domain}
- Company Name: {company_name}
- Page Title: {title}
- Meta Description: {desc}
- Meta Keywords: {keywords}
- Key Headings: {headings}
- Tech Stack Clues: {tech}
- Website Body Excerpt: {snippet}

Our Core Service Portfolio:
1. AI Automation & Agentic AI (Deploying autonomous lead qualification agents, 24/7 AI inquiry responders, intelligent sales assistants)
2. Modern Web & Full-Stack Development (High-performance Next.js 14 web apps, ultra-fast UI/UX redesigns, conversion speed optimization)
3. Technical SEO & Growth Marketing (On-page meta structuring, search ranking dominance, acquisition funnels)
4. Machine Learning & Predictive Systems (Data intelligence, revenue forecasting, personalized recommendation engines)
5. Workflow & Business Process Automation (Zero-SQL pipelines, CRM auto-sync, eliminating manual operational bottlenecks)

Task:
1. Determine the EXACT specific business industry/niche (e.g. "Real Estate Marketplace & Property Portals", "E-Commerce Luxury & Fashion", "B2B SaaS Cloud Solutions", "Healthcare & Dental Clinic", "Automotive Dealership & Auto Parts", "Digital Marketing & Creative Agency", etc.).
2. Detect 2-3 genuine operational, technical, or customer acquisition bottlenecks (pain points) this business is facing based on their website structure, digital presence, and copy.
3. Select the SINGLE most impactful service from our 5 offerings that they urgently need.
4. Calculate a Need/Opportunity Score from 65 to 98 (higher means greater transformation potential).
5. Provide a 1-sentence consultative pitch angle explaining why our service solves their exact bottleneck.

Return JSON ONLY in this format (no markdown, no backticks):
{{
  "detected_niche": "{niche_fallback}",
  "top_service_need": "AI Automation & Agentic AI",
  "need_score": 92,
  "pain_points": "Lacks 24/7 autonomous inquiry responders; lead qualification suffers from manual response delays; needs dynamic conversion funnel optimization.",
  "pitch_angle": "Implementing an autonomous conversational AI agent will capture and qualify inbound leads in under 60 seconds."
}}
"""
        # Default intelligent heuristic fallback
        fallback_result = {
            "detected_niche": niche_fallback,
            "top_service_need": "AI Automation & Agentic AI" if "real estate" in snippet.lower() or "ecommerce" in snippet.lower() or "store" in snippet.lower() else "Modern Web & Full-Stack Development",
            "need_score": 88,
            "pain_points": f"Website lacks automated 24/7 customer interaction touchpoints and high-conversion dynamic funnel infrastructure tailored for {niche_fallback}.",
            "pitch_angle": f"Modernizing the digital architecture with autonomous AI acquisition pipelines to accelerate {niche_fallback} revenue growth."
        }

        if settings.GEMINI_API_KEY:
            try:
                loop = asyncio.get_event_loop()
                model = genai.GenerativeModel("gemini-2.5-flash")
                response = await loop.run_in_executor(None, lambda: model.generate_content(prompt))
                if response and response.text:
                    raw = response.text.strip()
                    if "```json" in raw:
                        raw = raw.split("```json")[1].split("```")[0].strip()
                    elif "```" in raw:
                        raw = raw.split("```")[1].split("```")[0].strip()
                    
                    data = json.loads(raw)
                    return {
                        "detected_niche": data.get("detected_niche") or niche_fallback,
                        "top_service_need": data.get("top_service_need") or fallback_result["top_service_need"],
                        "need_score": int(data.get("need_score") or 88),
                        "pain_points": data.get("pain_points") or fallback_result["pain_points"],
                        "pitch_angle": data.get("pitch_angle") or fallback_result["pitch_angle"]
                    }
            except Exception as e:
                logger.warning(f"Gemini pain point analysis note for {domain}: {e}. Using structured fallback.")

        return fallback_result

    async def _fallback_hunter_api(self, domain: str) -> List[Dict[str, Any]]:
        key_info = await key_service.get_active_key("hunter")
        api_key = key_info.get("api_key") if key_info else settings.HUNTER_API_KEY
        if not api_key:
            return []

        clean_domain = domain.strip().replace(" ", "").lower()
        url = "https://api.hunter.io/v2/domain-search"
        params = {"domain": clean_domain, "api_key": api_key, "limit": 10}

        results = []
        try:
            async with httpx.AsyncClient(timeout=3.5) as client:
                res = await client.get(url, params=params)
                if res.status_code in [402, 429]:
                    if key_info:
                        await key_service.mark_exhausted_and_rotate("hunter", key_info, f"HTTP {res.status_code}")
                    return []
                
                if res.status_code == 200:
                    if key_info:
                        await key_service.record_call(key_info)
                    data = res.json()
                    emails = data.get("data", {}).get("emails", [])
                    for e in emails:
                        val = e.get("value")
                        pos = e.get("position") or ""
                        first = e.get("first_name") or ""
                        last = e.get("last_name") or ""
                        name = f"{first} {last}".strip()
                        if val:
                            results.append({
                                "email": val.lower().strip(),
                                "name": name,
                                "position": pos,
                                "confidence": e.get("confidence", 0)
                            })
        except Exception as e:
            logger.debug(f"Hunter API note for {clean_domain}: {e}")
        return results

    async def _fallback_tomba_api(self, domain: str) -> List[Dict[str, Any]]:
        key_info = await key_service.get_active_key("tomba")
        api_key = key_info.get("api_key") if key_info else settings.TOMBA_API_KEY
        if not api_key:
            return []

        clean_domain = domain.strip().replace(" ", "").lower()
        url = "https://api.tomba.io/v1/domain-search"
        params = {"domain": clean_domain}
        headers = {
            "X-Tomba-Key": api_key,
            "X-Tomba-Secret": api_key,
            "Authorization": f"Bearer {api_key}"
        }

        results = []
        try:
            async with httpx.AsyncClient(timeout=3.5) as client:
                res = await client.get(url, params=params, headers=headers)
                if res.status_code in [402, 429]:
                    if key_info:
                        await key_service.mark_exhausted_and_rotate("tomba", key_info, f"HTTP {res.status_code}")
                    return []
                
                if res.status_code == 200:
                    if key_info:
                        await key_service.record_call(key_info)
                    data = res.json()
                    emails = data.get("data", {}).get("emails", [])
                    for e in emails:
                        val = e.get("email")
                        pos = e.get("position") or ""
                        name = e.get("full_name") or ""
                        if val:
                            results.append({
                                "email": val.lower().strip(),
                                "name": name,
                                "position": pos,
                                "confidence": e.get("score", 0)
                            })
        except Exception as e:
            logger.debug(f"Tomba API note for {clean_domain}: {e}")
        return results

    async def process_domain(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process a single domain:
        1. Web crawl via BeautifulSoup (extract ALL emails, real phones, and website text metadata)
        2. Hunter.io / Tomba.io executive email discovery
        3. Prioritize Founder/CEO/Executives at the front
        4. Run AI Website Pain Point & Service Need Analysis via Gemini 2.5
        5. Update Sheet 1 with rich intelligence
        """
        row_idx = row["row_index"]
        domain = row["domain"].strip().replace(" ", "").lower()
        company_name = row.get("company_name") or domain.split(".")[0].replace("-", " ").title()

        logger.info(f"Stage 2 Scraping & AI Pain-Point Analysis for domain: {domain} (Row {row_idx})")
        scraped_emails, scraped_phones, site_context = await self._crawl_website(domain)

        # Hunter & Tomba Executive Discovery (in parallel)
        hunter_leads, tomba_leads = await asyncio.gather(
            self._fallback_hunter_api(domain),
            self._fallback_tomba_api(domain),
            return_exceptions=True
        )
        hunter_leads = hunter_leads if isinstance(hunter_leads, list) else []
        tomba_leads = tomba_leads if isinstance(tomba_leads, list) else []

        all_emails: List[str] = []
        for h in hunter_leads + tomba_leads:
            em = h["email"]
            pos = h.get("position", "").lower()
            if em not in all_emails:
                if any(t in pos for t in ["ceo", "founder", "owner", "president", "director", "head", "manager", "sales"]):
                    all_emails.insert(0, em)  # Insert decision maker at top
                else:
                    all_emails.append(em)

        # Append direct scraped website emails
        for em in scraped_emails:
            if em not in all_emails:
                all_emails.append(em)

        if not all_emails:
            all_emails.append(f"contact@{domain}")

        raw_email_str = ", ".join(all_emails[:5])
        raw_phone_str = ", ".join(scraped_phones[:2]) if scraped_phones else ""

        # AI Website Pain Point & Service Need Analysis
        ai_analysis = await self._analyze_website_pain_points(domain, company_name, site_context)
        top_service_need = ai_analysis.get("top_service_need", "AI Automation & Agentic AI")
        need_score = ai_analysis.get("need_score", 88)
        pain_points = ai_analysis.get("pain_points", "")

        status = "DONE" if all_emails else "REJECTED"

        await db.update_raw_domain(
            row_index=row_idx,
            company_name=company_name,
            raw_email=raw_email_str,
            phone_number=raw_phone_str,
            top_service_need=top_service_need,
            need_score=need_score,
            pain_points=pain_points,
            scrape_status=status
        )

        return {
            "domain": domain,
            "company_name": company_name,
            "raw_email": raw_email_str,
            "phone_number": raw_phone_str,
            "top_service_need": top_service_need,
            "need_score": need_score,
            "pain_points": pain_points,
            "emails_count": len(all_emails),
            "status": status
        }

    async def scrape_pending(self, batch_size: int = 10) -> Dict[str, Any]:
        """
        Fetch PENDING leads from Sheet 1 and execute Stage 2 scraping & AI analysis.
        """
        pending_rows = await db.get_raw_domains(status="PENDING")
        if not pending_rows:
            logger.info("No PENDING domains to scrape in Sheet 1.")
            return {"status": "success", "processed": 0, "results": []}

        limit = min(batch_size, len(pending_rows))
        logger.info(f"Found {len(pending_rows)} PENDING domains. Scraping & analyzing batch of {limit}...")
        results = []
        for row in pending_rows[:limit]:
            res = await self.process_domain(row)
            results.append(res)
            await asyncio.sleep(0.4)

    async def analyze_custom_domain(self, domain: str) -> Dict[str, Any]:
        """
        Deeply crawl and analyze an uploaded custom domain:
        1. Extract emails & phone numbers from website
        2. Detect website structure, metadata, tech signals
        3. Identify exact business niche/industry
        4. Detect genuine operational/technical pain points with Gemini AI
        5. Return structured lead data ready for Sheet 1
        """
        clean_domain = domain.strip().replace(" ", "").lower().replace("https://", "").replace("http://", "").replace("www.", "").split("/")[0]
        company_name = clean_domain.split(".")[0].replace("-", " ").title()

        logger.info(f"Custom Upload Deep Analysis for domain: {clean_domain}")
        scraped_emails, scraped_phones, site_context = await self._crawl_website(clean_domain)

        # Better company name from site title if available
        if site_context.get("title"):
            raw_title = site_context["title"].split("|")[0].split("-")[0].split("–")[0].strip()
            if raw_title and len(raw_title) < 40 and not any(k in raw_title.lower() for k in ["404", "not found", "access denied", "just a moment", "loading", "attention"]):
                company_name = raw_title

        # Hunter & Tomba Executive Discovery (in parallel)
        hunter_leads, tomba_leads = await asyncio.gather(
            self._fallback_hunter_api(clean_domain),
            self._fallback_tomba_api(clean_domain),
            return_exceptions=True
        )
        hunter_leads = hunter_leads if isinstance(hunter_leads, list) else []
        tomba_leads = tomba_leads if isinstance(tomba_leads, list) else []

        all_emails: List[str] = []
        for h in hunter_leads + tomba_leads:
            em = h.get("email")
            pos = h.get("position", "").lower()
            if em and em not in all_emails:
                if any(t in pos for t in ["ceo", "founder", "owner", "president", "director", "head", "manager", "sales"]):
                    all_emails.insert(0, em)
                else:
                    all_emails.append(em)

        for em in scraped_emails:
            if em not in all_emails:
                all_emails.append(em)

        if not all_emails:
            all_emails.append(f"contact@{clean_domain}")

        raw_email_str = ", ".join(all_emails[:5])
        raw_phone_str = ", ".join(scraped_phones[:2]) if scraped_phones else ""

        # AI Website Niche & Pain Point Analysis
        ai_analysis = await self._analyze_website_pain_points(clean_domain, company_name, site_context)
        detected_niche = ai_analysis.get("detected_niche", "Commercial Business")
        top_service_need = ai_analysis.get("top_service_need", "AI Automation & Agentic AI")
        need_score = ai_analysis.get("need_score", 88)
        pain_points = ai_analysis.get("pain_points", "")
        pitch_angle = ai_analysis.get("pitch_angle", "")

        status = "DONE" if (scraped_emails or hunter_leads or tomba_leads) else "PENDING"

        # Format pain points with clear niche prefix if not already present
        formatted_pain_points = f"[{detected_niche}] {pain_points}" if detected_niche not in pain_points else pain_points

        return {
            "domain": clean_domain,
            "company_name": company_name,
            "raw_email": raw_email_str,
            "phone_number": raw_phone_str,
            "detected_niche": detected_niche,
            "top_service_need": top_service_need,
            "need_score": need_score,
            "pain_points": formatted_pain_points,
            "pitch_angle": pitch_angle,
            "emails_count": len(all_emails),
            "scrape_status": status
        }

scraper_service = ScraperService()

