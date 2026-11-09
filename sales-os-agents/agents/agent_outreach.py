"""Agent 2: CASL Outreach & Dispatcher."""
from __future__ import annotations

import asyncio
import random
import smtplib
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Optional

import httpx

from agents.base_agent import BaseAgent
from config import settings
from models import Lead, LeadStatus


class EmailSender:
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self._domain_counts: dict[str, int] = defaultdict(int)
        self._day: int = datetime.now(timezone.utc).day

    def _reset_if_new_day(self):
        today = datetime.now(timezone.utc).day
        if today != self._day:
            self._domain_counts.clear()
            self._day = today

    def _domain(self, email: str) -> str:
        return (email.split("@")[-1] if "@" in email else "unknown").lower()

    async def send(self, to: str, subject: str, html: str, text: str = "") -> bool:
        self._reset_if_new_day()
        domain = self._domain(to)
        if self._domain_counts[domain] >= settings.max_emails_per_domain_per_day:
            return False
        await asyncio.sleep(random.uniform(settings.send_jitter_min, settings.send_jitter_max) if not self.dry_run else 0)

        if self.dry_run:
            print(f"[DRY-RUN EMAIL] to={to} subject={subject!r} bytes={len(html)}")
            self._domain_counts[domain] += 1
            return True

        # Prefer Resend if configured
        if settings.resend_api_key:
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(
                        "https://api.resend.com/emails",
                        headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                        json={
                            "from": f"{settings.sender_name} <{settings.sender_email}>",
                            "to": [to],
                            "subject": subject,
                            "html": html,
                            "text": text or None,
                        },
                    )
                if resp.status_code < 300:
                    self._domain_counts[domain] += 1
                    return True
                return False
            except Exception:  # noqa: BLE001
                return False

        # Fallback SMTP
        try:
            await asyncio.to_thread(self._smtp_send, to, subject, html, text)
            self._domain_counts[domain] += 1
            return True
        except Exception:  # noqa: BLE001
            return False

    def _smtp_send(self, to, subject, html, text):
        msg = EmailMessage()
        msg["From"] = f"{settings.sender_name} <{settings.sender_email}>"
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(text or "See HTML version.")
        msg.add_alternative(html, subtype="html")
        with smtplib.SMTP("localhost", 25) as s:
            s.send_message(msg)


class AgentOutreach(BaseAgent):
    name = "agent_outreach"
    consumes = LeadStatus.LEAD_VERIFIED_PRIORITY_A.value
    produces = LeadStatus.CAMPAIGN_DISPATCHED.value

    def __init__(self, db, dry_run=False, sender=None, template_path=None):
        super().__init__(db, dry_run=dry_run)
        self.sender = sender or EmailSender(dry_run=dry_run)
        self.template_path = template_path or settings.template_path

    def _render(self, lead: Lead) -> str:
        template = self.template_path.read_text(encoding="utf-8")
        offer_line = lead.offer_line or (
            "$499 one-time website purchase, 30 free days of the AI Growth Agent, "
            "then optional $299/month; the website remains the client's property."
        )
        first_name = lead.principal_dentist.split()[0] if lead.principal_dentist else (lead.office_manager.split()[0] if lead.office_manager else "Doctor & Team")
        values = {
            "clinic_name": lead.clinic_name,
            "first_name": first_name,
            "city": lead.city,
            "evidence_hook": lead.evidence_hook or "strong local reputation",
            "keyword_hook": lead.keyword_hook or f"dentist {lead.city.lower()}",
            "offer_line": offer_line,
            "legal_business_name": settings.legal_business_name,
            "mailing_address": settings.mailing_address,
            "contact_email": settings.sender_email,
            "unsubscribe_url": f"{settings.unsubscribe_base_url}?email={lead.email}&clinic={lead.clinic_name}",
        }
        for k, v in values.items():
            template = template.replace("{{" + k + "}}", str(v))
        return template

    def _casl_ok(self, html: str) -> bool:
        return (
            settings.legal_business_name in html
            and settings.mailing_address in html
            and "unsubscribe" in html.lower()
        )

    def _ensure_casl_footer(self, html: str) -> str:
        if self._casl_ok(html):
            return html
        footer = (
            f'<div style="margin-top:24px;font-size:11px;color:#81929A;">'
            f'{settings.legal_business_name} · {settings.mailing_address} · '
            f'<a href="{settings.unsubscribe_base_url}">Unsubscribe</a></div>'
        )
        return html + footer

    async def process(self, lead: Lead) -> None:
        html = self._ensure_casl_footer(self._render(lead))
        if not self._casl_ok(html):
            await self.db.log_event(lead.id, "casl_failure", {"agent": self.name})
            return
        subject = f"{lead.clinic_name} — a quick note from Valioz Health"
        ok = await self.sender.send(lead.email, subject, html)
        if not ok:
            await self.db.log_event(lead.id, "send_failed", {"agent": self.name, "to": lead.email})
            return
        lead.metadata["cadence_step"] = 0
        lead.metadata["next_followup_at"] = (datetime.now(timezone.utc) + timedelta(days=4)).isoformat()
        await self.handover(lead, LeadStatus.CAMPAIGN_DISPATCHED.value, "day-0 email dispatched")
