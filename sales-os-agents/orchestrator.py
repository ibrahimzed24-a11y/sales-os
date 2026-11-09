"""Master orchestrator: continuous async loop advancing leads across 5 agents."""
from __future__ import annotations

import asyncio
from typing import List, Optional

from agents.agent_intel import AgentIntel
from agents.agent_lifecycle import AgentLifecycle
from agents.agent_outreach import AgentOutreach
from agents.agent_proposal import AgentProposal
from agents.agent_triage import AgentTriage, InboundReply
from agents.base_agent import BaseAgent
from db import Database
from models import Lead, LeadStatus


class Orchestrator:
    def __init__(self, db: Database, dry_run: bool = False, email_sender=None):
        self.db = db
        self.dry_run = dry_run
        self.intel = AgentIntel(db, dry_run=dry_run)
        self.outreach = AgentOutreach(db, dry_run=dry_run, sender=email_sender)
        self.triage = AgentTriage(db, dry_run=dry_run, sender=email_sender)
        self.proposal = AgentProposal(db, dry_run=dry_run, sender=email_sender)
        self.lifecycle = AgentLifecycle(db, dry_run=dry_run, sender=email_sender)
        self.agents: List[BaseAgent] = [
            self.intel, self.outreach, self.proposal, self.lifecycle,
        ]
        self._inbound: asyncio.Queue[InboundReply] = asyncio.Queue()

    async def seed_leads(self, leads: list[Lead]) -> None:
        for lead in leads:
            await self.db.upsert_lead(lead)

    async def feed_reply(self, reply: InboundReply) -> None:
        await self._inbound.put(reply)

    async def _process_inbound(self) -> None:
        while not self._inbound.empty():
            reply = await self._inbound.get()
            try:
                await self.triage.handle_reply(reply)
            except Exception as exc:  # noqa: BLE001
                await self.db.log_event(reply.lead_id, "triage_error", {"error": str(exc)})

    async def run_once(self) -> dict:
        await self._process_inbound()
        results = {}
        for agent in self.agents:
            try:
                results[agent.name] = await agent.run_once()
            except Exception as exc:  # noqa: BLE001
                results[agent.name] = f"error: {exc}"
        return results

    async def run(self, interval: float = 5.0, max_iterations: Optional[int] = None):
        i = 0
        while max_iterations is None or i < max_iterations:
            await self.run_once()
            i += 1
            await asyncio.sleep(interval)

    async def confirm_payment(self, quote_id: str) -> bool:
        return await self.proposal.confirm_payment(quote_id)
