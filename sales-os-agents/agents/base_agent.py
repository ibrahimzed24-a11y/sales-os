"""Abstract base agent with run(), log(), and handover() primitives."""
from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Any, Optional

from config import settings
from db import Database
from models import Lead, LeadStatus, StateTransition

logger = logging.getLogger("sales_os.agents")


class BaseAgent(ABC):
    name: str = "base"
    consumes: str = ""
    produces: str = ""

    def __init__(self, db: Database, dry_run: bool = False):
        self.db = db
        self.dry_run = dry_run
        self.log = logging.getLogger(f"sales_os.agents.{self.name}")

    async def run_once(self) -> int:
        """Process one batch. Returns number of leads advanced."""
        if not self.consumes:
            return 0
        leads = await self.db.list_leads_by_status(self.consumes)
        advanced = 0
        for lead in leads:
            try:
                await self.process(lead)
                advanced += 1
            except Exception as exc:  # noqa: BLE001
                self.log.exception("agent %s failed on lead %s: %s", self.name, lead.id, exc)
                await self.db.log_event(lead.id, "agent_error", {"agent": self.name, "error": str(exc)})
        return advanced

    @abstractmethod
    async def process(self, lead: Lead) -> None:
        ...

    async def handover(self, lead: Lead, new_status: str, reason: str = "") -> None:
        old = lead.status
        lead.status = LeadStatus(new_status) if isinstance(new_status, str) else new_status
        lead.updated_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
        await self.db.upsert_lead(lead)
        await self.db.add_transition(
            StateTransition(lead_id=lead.id, from_status=old, to_status=new_status, agent=self.name, reason=reason)
        )
        await self.db.log_event(lead.id, "state_transition", {"from": str(old), "to": new_status, "agent": self.name})
        self.log.info("handover %s: %s -> %s (%s)", lead.id, old, new_status, reason)

    async def retry(self, coro, attempts: int = 3, delay: float = 1.0):
        last = None
        for i in range(attempts):
            try:
                return await coro()
            except Exception as exc:  # noqa: BLE001
                last = exc
                await asyncio.sleep(delay * (i + 1))
        raise last  # type: ignore[misc]

    async def run_loop(self, interval: float = 5.0, max_iterations: Optional[int] = None):
        i = 0
        while max_iterations is None or i < max_iterations:
            await self.run_once()
            i += 1
            await asyncio.sleep(interval)
