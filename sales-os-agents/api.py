"""FastAPI surface for the Sales OS agent pipeline."""
from __future__ import annotations

import asyncio
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from db import Database
from main import build_orchestrator
from models import InboundReply, Lead, LeadStatus


class HealthResponse(BaseModel):
    status: str = "ok"


def create_app() -> FastAPI:
    app = FastAPI(title="Sales OS Agents", version="0.1.0")
    db_holder: dict = {}

    async def get_db():
        if "db" not in db_holder:
            db, _ = await build_orchestrator(dry_run=True)
            db_holder["db"] = db
            db_holder["orch"] = _
        return db_holder["db"], db_holder["orch"]

    @app.get("/health", response_model=HealthResponse)
    async def health():
        return HealthResponse()

    @app.get("/leads")
    async def list_leads(status: Optional[str] = None):
        db, _ = await get_db()
        if status:
            leads = await db.list_leads_by_status(status)
        else:
            leads = []
            for st in LeadStatus:
                leads.extend(await db.list_leads_by_status(st.value))
        return [l.model_dump(mode="json") for l in leads]

    @app.post("/leads")
    async def create_lead(lead: Lead):
        db, _ = await get_db()
        await db.upsert_lead(lead)
        return lead.model_dump(mode="json")

    @app.post("/replies")
    async def post_reply(reply: InboundReply):
        db, orch = await get_db()
        result = await orch.triage.handle_reply(reply)
        return result.model_dump(mode="json")

    @app.post("/quotes/{quote_id}/confirm-payment")
    async def confirm_payment(quote_id: str):
        db, orch = await get_db()
        ok = await orch.confirm_payment(quote_id)
        if not ok:
            raise HTTPException(status_code=404, detail="quote not found")
        return {"confirmed": True}

    @app.post("/run-once")
    async def run_once():
        db, orch = await get_db()
        return await orch.run_once()

    return app


app = create_app()
