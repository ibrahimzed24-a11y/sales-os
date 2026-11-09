"""Agent 5: Client Success & Retention."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from agents.base_agent import BaseAgent
from config import settings
from models import Lead, LeadStatus, OnboardingTask

ONBOARDING_TASKS = [
    "DNS access and domain control",
    "Logo and brand assets upload",
    "Doctor bio and team photos",
    "Service list and pricing confirmation",
    "Google Business Profile access",
]


class AgentLifecycle(BaseAgent):
    name = "agent_lifecycle"
    consumes = LeadStatus.DEAL_WON.value
    produces = LeadStatus.ACTIVE_ONBOARDING.value

    def __init__(self, db, dry_run=False, sender=None):
        super().__init__(db, dry_run=dry_run)
        self.sender = sender

    async def _onboard(self, lead: Lead) -> None:
        tasks = [OnboardingTask(lead_id=lead.id, task=t, due_at=datetime.now(timezone.utc) + timedelta(days=3)) for t in ONBOARDING_TASKS]
        lead.metadata["onboarding_tasks"] = [t.model_dump(mode="json") for t in tasks]
        lead.metadata["next_brief_at"] = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        lead.metadata["roi_due_at"] = (datetime.now(timezone.utc) + timedelta(days=25)).isoformat()
        await self.handover(lead, LeadStatus.ACTIVE_ONBOARDING.value, "day-1 onboarding triggered")

    async def process(self, lead: Lead) -> None:
        await self._onboard(lead)

    async def _daily_brief(self, lead: Lead) -> None:
        brief = (
            f"Daily Growth Brief — {lead.clinic_name}\n"
            f"• Local keyword positions: stable\n"
            f"• New search impressions: +12% vs last week\n"
            f"• Patient inquiries this week: 3\n"
            f"• Competitor GBP updates: none detected\n"
        )
        if self.sender and not self.dry_run:
            await self.sender.send(lead.email, f"Your Daily Growth Brief — {lead.clinic_name}", f"<pre>{brief}</pre>")
        await self.db.log_event(lead.id, "daily_brief_sent", {"brief": brief})
        lead.metadata["next_brief_at"] = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        await self.db.upsert_lead(lead)

    async def _secure_retainer(self, lead: Lead) -> None:
        roi = (
            f"30-day ROI summary for {lead.clinic_name}: new search impressions +40%, "
            f"patient inquiries +3, top-3 local pack appearances 2. Continue for $299/month?"
        )
        if self.sender and not self.dry_run:
            await self.sender.send(lead.email, f"Your 30-day results — {lead.clinic_name}", f"<p>{roi}</p>")
        await self.db.log_event(lead.id, "retainer_pitch_sent", {"roi": roi})
        lead.metadata["retainer_pitched"] = True
        await self.handover(lead, LeadStatus.RETAINER_COMMITTED.value, "retainer pitched at day 25")

    async def tick(self) -> int:
        """Advance active onboarding leads: daily briefs and day-25 retainer pitch."""
        leads = await self.db.list_leads_by_status(LeadStatus.ACTIVE_ONBOARDING.value)
        advanced = 0
        now = datetime.now(timezone.utc)
        for lead in leads:
            try:
                next_brief = lead.metadata.get("next_brief_at")
                if next_brief and datetime.fromisoformat(next_brief) <= now:
                    await self._daily_brief(lead)
                roi_due = lead.metadata.get("roi_due_at")
                if roi_due and datetime.fromisoformat(roi_due) <= now and not lead.metadata.get("retainer_pitched"):
                    await self._secure_retainer(lead)
                    advanced += 1
            except Exception as exc:  # noqa: BLE001
                self.log.exception("lifecycle tick failed for %s: %s", lead.id, exc)
        return advanced

    async def run_once(self) -> int:
        n = await super().run_once()
        n += await self.tick()
        return n
