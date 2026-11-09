"""Agent 3: Inbound Concierge & Triage."""
from __future__ import annotations

import json
import re
from typing import Optional

from agents.base_agent import BaseAgent
from config import settings
from models import InboundReply, Lead, LeadStatus, TriageIntent, TriageResult

POSITIVE_KEYWORDS = ("yes", "interested", "tell me more", "next steps", "book", "call", "audit", "demo")
PMS_KEYWORDS = ("cleardent", "tracker", "dentrix", "curve", "abeldent", "open dental", "pms", "software", "integrate", "compatible")
PRICING_KEYWORDS = ("price", "cost", "expensive", "budget", "fee", "how much", "$")
UNSUB_KEYWORDS = ("unsubscribe", "stop", "remove", "no thanks", "not interested", "do not contact")


class AgentTriage(BaseAgent):
    name = "agent_triage"
    consumes = ""  # triggered by inbound events, not a status queue
    produces = LeadStatus.QUALIFIED_DEAL.value

    def __init__(self, db, dry_run=False, sender=None):
        super().__init__(db, dry_run=dry_run)
        self.sender = sender

    async def classify(self, reply: InboundReply) -> TriageResult:
        text = (reply.subject + " " + reply.body).lower()
        # LLM path
        if settings.openai_api_key:
            try:
                from openai import AsyncOpenAI

                client = AsyncOpenAI(api_key=settings.openai_api_key)
                prompt = (
                    "Classify this dental clinic reply. Return JSON with keys intent, confidence, summary, pms_name.\n"
                    "intent must be one of POSITIVE_INTEREST, PMS_INQUIRY, OBJECTION_PRICING, UNSUBSCRIBE, OTHER.\n"
                    f"Reply:\n{reply.body}"
                )
                resp = await client.chat.completions.create(
                    model=settings.openai_model,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.0,
                )
                data = json.loads(resp.choices[0].message.content or "{}")
                intent = TriageIntent(data.get("intent", "OTHER"))
                return TriageResult(
                    intent=intent,
                    confidence=float(data.get("confidence", 0.7)),
                    summary=str(data.get("summary", "")),
                    pms_name=str(data.get("pms_name", "")),
                )
            except Exception:  # noqa: BLE001
                pass

        # Keyword fallback
        if any(k in text for k in UNSUB_KEYWORDS):
            return TriageResult(intent=TriageIntent.UNSUBSCRIBE, confidence=0.9, summary="unsubscribe requested")
        if any(k in text for k in PMS_KEYWORDS):
            pms = next((k for k in ("cleardent", "tracker", "dentrix", "curve", "abeldent", "open dental") if k in text), "")
            return TriageResult(intent=TriageIntent.PMS_INQUIRY, confidence=0.8, summary="PMS compatibility question", pms_name=pms)
        if any(k in text for k in PRICING_KEYWORDS):
            return TriageResult(intent=TriageIntent.OBJECTION_PRICING, confidence=0.7, summary="pricing question")
        if any(k in text for k in POSITIVE_KEYWORDS):
            return TriageResult(intent=TriageIntent.POSITIVE_INTEREST, confidence=0.8, summary="positive interest")
        return TriageResult(intent=TriageIntent.OTHER, confidence=0.4, summary="unclear")

    async def handle_reply(self, reply: InboundReply) -> TriageResult:
        lead = await self.db.get_lead(reply.lead_id)
        if lead is None:
            raise ValueError(f"unknown lead {reply.lead_id}")
        result = await self.classify(reply)
        await self.db.log_event(lead.id, "inbound_reply", {"intent": result.intent.value, "summary": result.summary})

        if result.intent == TriageIntent.UNSUBSCRIBE:
            lead.unsubscribed = True
            await self.handover(lead, LeadStatus.SUPPRESSED_CASL.value, "unsubscribe requested")
            return result

        if result.intent == TriageIntent.POSITIVE_INTEREST:
            await self.handover(lead, LeadStatus.QUALIFIED_DEAL.value, "positive interest")
            return result

        if result.intent == TriageIntent.PMS_INQUIRY:
            if self.sender and not self.dry_run:
                await self.sender.send(
                    lead.email,
                    "Re: your question about practice software",
                    f"<p>Hi,</p><p>Yes — VALIOZ Health works with {result.pms_name or 'your practice software'} and most major PMS platforms. "
                    f"We connect via standard exports and never need full PMS access.</p><p>Happy to walk through it on a 15-minute call.</p>",
                )
            await self.db.log_event(lead.id, "pms_response_sent", {"pms": result.pms_name})
            return result

        if result.intent == TriageIntent.OBJECTION_PRICING:
            if self.sender and not self.dry_run:
                await self.sender.send(
                    lead.email,
                    "Re: pricing",
                    "<p>Hi,</p><p>The $499 launch is a one-time purchase and the website stays yours. "
                    "The $299/month Growth Agent is optional after the first 30 free days, and you can cancel anytime.</p>",
                )
            await self.db.log_event(lead.id, "pricing_response_sent", {})
            return result

        await self.db.log_event(lead.id, "reply_other", {"summary": result.summary})
        return result

    async def process(self, lead: Lead) -> None:
        # Triage is event-driven; process() is a no-op for the queue loop.
        return None
