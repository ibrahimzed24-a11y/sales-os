"""Agent 1: Clinic Intel & Verification."""
from __future__ import annotations

import re
from typing import Optional

import httpx

from agents.base_agent import BaseAgent
from config import settings
from models import Lead, LeadStatus

DSO_KEYWORDS = ("dentalcorp", "123dentist", "altima", "dso", "mydentist")
BOOKING_ENGINES = ("tracker", "curve", "dentrix", "cleardent", "open dental", "abeldent")
DIRECTORY_HOSTS = ("facebook.com", "instagram.com", "yellowpages.ca", "ratemds.com", "google.com")


class IntelBrowser:
    """Lightweight URL auditor; prefers httpx, can use browser-use when enabled."""

    async def audit(self, url: str) -> dict:
        if not url:
            return {"status": "no_url", "http_status": None, "booking_engine": "", "mobile_friendly": False, "title": ""}
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, headers={"User-Agent": "ValiozIntel/1.0"}) as client:
                resp = await client.get(url)
        except Exception as exc:  # noqa: BLE001
            return {"status": "error", "http_status": None, "error": str(exc), "booking_engine": "", "mobile_friendly": False, "title": ""}

        text = resp.text or ""
        lower = text.lower()
        engine = ""
        for candidate in BOOKING_ENGINES:
            if candidate in lower:
                engine = candidate.title()
                break
        mobile = 'name="viewport"' in lower or "name='viewport'" in lower
        title_match = re.search(r"<title[^>]*>(.*?)</title>", text, re.IGNORECASE | re.DOTALL)
        title = (title_match.group(1).strip() if title_match else "")[:120]
        return {
            "status": "ok" if resp.status_code < 400 else "http_error",
            "http_status": resp.status_code,
            "booking_engine": engine,
            "mobile_friendly": mobile,
            "title": title,
        }


class AgentIntel(BaseAgent):
    name = "agent_intel"
    consumes = LeadStatus.SCRAPED_RAW.value
    produces = LeadStatus.LEAD_VERIFIED_PRIORITY_A.value

    def __init__(self, db, dry_run=False, intel_browser=None):
        super().__init__(db, dry_run=dry_run)
        self.browser = intel_browser or IntelBrowser()

    async def process(self, lead: Lead) -> None:
        # 1. DSO filter
        haystack = f"{lead.clinic_name} {lead.parent_dso}".lower()
        if any(k in haystack for k in DSO_KEYWORDS):
            await self.handover(lead, LeadStatus.REJECTED_DSO.value, "corporate DSO detected")
            return

        # 2. URL audit
        audit = await self.browser.audit(lead.website)
        lead.metadata["audit"] = audit
        lead.booking_engine = audit.get("booking_engine", "")
        lead.website_opportunity = False

        status = audit["status"]
        if status in ("no_url", "error") or (audit.get("http_status") or 0) >= 400:
            lead.website_state = "broken"
            lead.website_opportunity = True
            await self.handover(lead, LeadStatus.HOLD_SITE_DOWN.value, f"site check: {status} {audit.get('http_status')}")
            return
        if not audit.get("mobile_friendly"):
            lead.website_opportunity = True
        lead.website_state = "live"

        # 3. Merge scoring (already on lead; ensure tier defaults)
        if not lead.tier:
            lead.tier = "C"
        if lead.score is None:
            lead.score = 0

        await self.handover(lead, LeadStatus.LEAD_VERIFIED_PRIORITY_A.value, "verified independent clinic")
