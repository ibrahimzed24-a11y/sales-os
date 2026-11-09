"""End-to-end dry-run test: Fraserview Dentist through all 5 agent stages."""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db import Database
from main import build_orchestrator, sample_leads
from models import InboundReply, LeadStatus


async def main():
    db, orch = await build_orchestrator(dry_run=True)

    leads = sample_leads()
    fraserview = next(l for l in leads if l.clinic_name == "Fraserview Dentist")
    await orch.seed_leads([fraserview])
    assert (await db.get_lead(fraserview.id)).status == LeadStatus.SCRAPED_RAW

    # Stage 1: Intel
    await orch.intel.run_once()
    lead = await db.get_lead(fraserview.id)
    assert lead.status == LeadStatus.LEAD_VERIFIED_PRIORITY_A, lead.status
    print("Stage 1 OK: LEAD_VERIFIED_PRIORITY_A")

    # Stage 2: Outreach
    await orch.outreach.run_once()
    lead = await db.get_lead(fraserview.id)
    assert lead.status == LeadStatus.CAMPAIGN_DISPATCHED, lead.status
    print("Stage 2 OK: CAMPAIGN_DISPATCHED")

    # Stage 3: Triage (positive reply)
    await orch.feed_reply(InboundReply(lead_id=fraserview.id, from_email=fraserview.email, subject="Re: note", body="Yes, tell me more about next steps."))
    await orch._process_inbound()
    lead = await db.get_lead(fraserview.id)
    assert lead.status == LeadStatus.QUALIFIED_DEAL, lead.status
    print("Stage 3 OK: QUALIFIED_DEAL")

    # Stage 4: Proposal
    await orch.proposal.run_once()
    lead = await db.get_lead(fraserview.id)
    assert lead.status == LeadStatus.INVOICE_SENT, lead.status
    quote_id = lead.metadata["quote_id"]
    print("Stage 4 OK: INVOICE_SENT", quote_id)

    # Payment confirmation -> DEAL_WON
    ok = await orch.confirm_payment(quote_id)
    assert ok
    lead = await db.get_lead(fraserview.id)
    assert lead.status == LeadStatus.DEAL_WON, lead.status
    print("Stage 4b OK: DEAL_WON")

    # Stage 5: Lifecycle onboarding
    await orch.lifecycle.run_once()
    lead = await db.get_lead(fraserview.id)
    assert lead.status == LeadStatus.ACTIVE_ONBOARDING, lead.status
    assert lead.metadata.get("onboarding_tasks")
    print("Stage 5 OK: ACTIVE_ONBOARDING")

    # Day-25 retainer: fast-forward
    lead.metadata["roi_due_at"] = datetime.now(timezone.utc).isoformat()
    await db.upsert_lead(lead)
    await orch.lifecycle.tick()
    lead = await db.get_lead(fraserview.id)
    assert lead.status == LeadStatus.RETAINER_COMMITTED, lead.status
    print("Stage 5b OK: RETAINER_COMMITTED")

    # Billings Bridge (broken site) should be on hold
    billings = next(l for l in sample_leads() if l.clinic_name == "Billings Bridge Dental Centre")
    await orch.seed_leads([billings])
    await orch.intel.run_once()
    b = await db.get_lead(billings.id)
    assert b.status == LeadStatus.HOLD_SITE_DOWN, b.status
    print("Hold check OK: HOLD_SITE_DOWN")

    print("\nALL 5 STAGES PASSED (dry-run).")


if __name__ == "__main__":
    asyncio.run(main())
