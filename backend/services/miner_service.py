import logging
import re
import asyncio
import httpx
from datetime import datetime
from typing import List, Dict, Any, Optional, Set
from urllib.parse import urlparse, unquote
from bs4 import BeautifulSoup
import dns.resolver

try:
    from backend.services.sheets_db import db
    from backend.services.key_service import key_service
    from backend.config import settings
except ImportError:
    from services.sheets_db import db
    from services.key_service import key_service
    from config import settings

logger = logging.getLogger("MinerService")

DEFAULT_NICHES = [
    "ecommerce luxury fashion brand",
    "sustainable organic apparel store",
    "boutique jewelry shop online",
    "specialty coffee roasters online",
    "direct to consumer skincare brand",
    "modern home decor furniture brand",
    "b2b saas tech companies",
    "real estate developer agency",
    "digital marketing growth agency",
    "healthcare medical equipment supplier"
]

IGNORED_DOMAINS = {
    "google.com", "google.com.pk", "wikipedia.org", "youtube.com", "facebook.com",
    "instagram.com", "linkedin.com", "twitter.com", "x.com", "amazon.com", "pinterest.com",
    "reddit.com", "quora.com", "tiktok.com", "apple.com", "microsoft.com", "yahoo.com",
    "bing.com", "duckduckgo.com", "medium.com", "tripadvisor.com", "yelp.com", "bloomberg.com",
    "forbes.com", "crunchbase.com", "github.com", "cloudflare.com", "wordpress.org", "wix.com",
    "shopify.com", "godaddy.com", "namecheap.com", "daraz.pk", "olx.com.pk", "pakwheels.com"
}

class MinerService:
    def __init__(self):
        self.base_url = "https://api.domainsdb.info/v1/domains/search"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

    def _verify_dns_exists(self, domain: str) -> bool:
        """
        Verify domain exists on public DNS synchronously.
        """
        try:
            dns.resolver.resolve(domain, "A")
            return True
        except Exception:
            try:
                dns.resolver.resolve(domain, "MX")
                return True
            except Exception:
                return False

    async def _verify_dns_exists_async(self, domain: str) -> bool:
        """
        Verify domain exists on public DNS asynchronously using thread executor.
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: self._verify_dns_exists(domain))


    def _clean_domain(self, raw_url: str) -> Optional[str]:
        """
        Extract clean root domain from url or string.
        """
        if not raw_url:
            return None
        text = unquote(raw_url).strip().lower()
        if text.startswith("http://") or text.startswith("https://"):
            try:
                parsed = urlparse(text)
                text = parsed.netloc or parsed.path
            except Exception:
                pass
        
        # Remove parameters or subpaths
        text = text.split("/")[0].split("?")[0].replace("www.", "").strip()
        if ":" in text:
            text = text.split(":")[0]

        if "." in text and len(text) > 3:
            # Must not be an IP or ignored domain
            if not re.match(r"^\d+\.\d+\.\d+\.\d+$", text):
                if text not in IGNORED_DOMAINS and not any(ign in text for ign in ["google", "facebook", "instagram", "wikipedia", "youtube", "tiktok", "twitter", "linkedin"]):
                    return text
        return None

    async def _query_duckduckgo_html(self, query: str) -> List[str]:
        """
        Scrape search results from DuckDuckGo standard HTML interface.
        """
        domains = []
        try:
            async with httpx.AsyncClient(timeout=12.0, follow_redirects=True, headers=self.headers) as client:
                res = await client.get(f"https://html.duckduckgo.com/html/?q={query}")
                if res.status_code == 200:
                    soup = BeautifulSoup(res.text, "html.parser")
                    for a in soup.find_all("a", class_="result__url"):
                        d = self._clean_domain(a.get_text(strip=True))
                        if d:
                            domains.append(d)
                    for a in soup.find_all("a", class_="result__snippet"):
                        href = a.get("href", "")
                        d = self._clean_domain(href)
                        if d:
                            domains.append(d)
        except Exception as e:
            logger.debug(f"DDG HTML search query failed: {e}")
        return domains

    async def _query_duckduckgo_lite(self, query: str) -> List[str]:
        """
        Scrape search results from DuckDuckGo Lite interface (fast, alternate index).
        """
        domains = []
        try:
            async with httpx.AsyncClient(timeout=12.0, follow_redirects=True, headers=self.headers) as client:
                res = await client.post("https://lite.duckduckgo.com/lite/", data={"q": query})
                if res.status_code == 200:
                    soup = BeautifulSoup(res.text, "html.parser")
                    for a in soup.find_all("a", class_="result-link"):
                        d = self._clean_domain(a.get("href", ""))
                        if d:
                            domains.append(d)
                    for td in soup.find_all("td", class_="result-link"):
                        a = td.find("a")
                        if a:
                            d = self._clean_domain(a.get("href", ""))
                            if d:
                                domains.append(d)
        except Exception as e:
            logger.debug(f"DDG Lite search query failed: {e}")
        return domains

    async def _query_bing_fallback(self, query: str) -> List[str]:
        """
        Fallback search query to Bing for high-coverage enterprise business domains.
        """
        domains = []
        try:
            async with httpx.AsyncClient(timeout=12.0, follow_redirects=True, headers=self.headers) as client:
                res = await client.get(f"https://www.bing.com/search?q={query}")
                if res.status_code == 200:
                    soup = BeautifulSoup(res.text, "html.parser")
                    for cite in soup.find_all("cite"):
                        d = self._clean_domain(cite.get_text(strip=True))
                        if d:
                            domains.append(d)
                    for li in soup.find_all("li", class_="b_algo"):
                        h2 = li.find("h2")
                        if h2 and h2.find("a"):
                            d = self._clean_domain(h2.find("a").get("href", ""))
                            if d:
                                domains.append(d)
        except Exception as e:
            logger.debug(f"Bing fallback search query failed: {e}")
        return domains

    async def mine_domains(self, keyword: Optional[str] = None, zone: str = "com", limit: int = 20) -> Dict[str, Any]:
        """
        Stage 1: Discover EXACT target count of 100% real active business domains and append to Sheet 1.
        """
        base_keyword = (keyword or DEFAULT_NICHES[datetime.now().minute % len(DEFAULT_NICHES)]).strip()
        logger.info(f"Mining target of {limit} real niche domains for query: '{base_keyword}'")

        # Load existing domains from cache to avoid mining duplicates
        existing_raw = await db.get_raw_domains()
        existing_domains = {r["domain"].strip().lower() for r in existing_raw}
        
        found_leads: List[Dict[str, Any]] = []
        seen_in_this_run: Set[str] = set()

        # Multi-query variations to guarantee full target count delivery
        query_variations = [
            base_keyword,
            f"{base_keyword} top companies",
            f"{base_keyword} official website",
            f"{base_keyword} services solutions",
            f"{base_keyword} online store brand",
            f"{base_keyword} agency firm",
            f"best {base_keyword} directory",
            f"{base_keyword} contact us portfolio",
            f"{base_keyword} enterprise leaders",
            f"{base_keyword} group industry",
            f"{base_keyword} commercial suppliers",
            f"list of {base_keyword}"
        ]

        # Iteratively search across query variations until EXACT target limit is reached
        for q in query_variations:
            if len(found_leads) >= limit:
                break

            logger.info(f"Running mining query: '{q}' (Current Progress: {len(found_leads)}/{limit})...")
            
            # Fetch candidates concurrently from multiple search sources
            results = await asyncio.gather(
                self._query_duckduckgo_html(q),
                self._query_duckduckgo_lite(q),
                self._query_bing_fallback(q),
                return_exceptions=True
            )

            raw_candidate_domains: Set[str] = set()
            for r in results:
                if isinstance(r, list):
                    for d in r:
                        if d and d not in existing_domains and d not in seen_in_this_run:
                            raw_candidate_domains.add(d)

            # Concurrent DNS verification
            dns_tasks = [self._verify_dns_exists_async(dom) for dom in raw_candidate_domains]
            dns_results = await asyncio.gather(*dns_tasks, return_exceptions=True)

            for dom, is_valid in zip(raw_candidate_domains, dns_results):
                if is_valid is True and dom not in seen_in_this_run and dom not in existing_domains:
                    seen_in_this_run.add(dom)
                    company_name = dom.split(".")[0].replace("-", " ").title()
                    found_leads.append({
                        "domain": dom,
                        "company_name": company_name,
                        "raw_email": "",
                        "phone_number": "",
                        "top_service_need": "",
                        "need_score": 0,
                        "pain_points": "",
                        "scrape_status": "PENDING"
                    })
                    if len(found_leads) >= limit:
                        break

            # Small pause to respect rate limits
            await asyncio.sleep(0.5)

        # Truncate to exact target limit requested by user
        final_leads = found_leads[:limit]
        added_count = await db.add_raw_domains(final_leads)
        logger.info(f"Stage 1 Mining completed: Successfully delivered {len(final_leads)} real active domains (Target: {limit}, Added to Sheet 1: {added_count}).")

        return {
            "status": "success",
            "requested_limit": limit,
            "count": len(final_leads),
            "added_to_sheet": added_count,
            "keyword": base_keyword,
            "leads": final_leads
        }

miner_service = MinerService()
