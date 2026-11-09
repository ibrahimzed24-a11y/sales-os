"""CLI / FastAPI entry points for the Sales OS agent pipeline."""
from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from config import settings
from db import Database
from models import InboundReply, Lead, LeadStatus
from orchestrator import Orchestrator


async def build_orchestrator(dry_run: bool = True) -> tuple[Database, Orchestrator]:
    db = Database()
    await db.init()
    from agents.agent_outreach import EmailSender

    sender = EmailSender(dry_run=dry_run)
    orch = Orchestrator(db=db, dry_run=dry_run, email_sender=sender)
    return db, orch


def sample_leads() -> list[Lead]:
    return [
        Lead(
            clinic_name="Fraserview Dentist",
            city="Vancouver",
            province="BC",
            email="info@fraserviewdentist.com",
            phone="(604) 325-1711",
            website="https://fraserviewdentist.com",
            parent_dso="Independent",
            google_rating=4.9,
            google_review_count=1220,
            cdcp_participating=True,
            score=85,
            tier="A",
            evidence_hook="1,220 reviews, 4.9; authorized CDCP provider",
            keyword_hook="dentist vancouver: 1K-10K, Medium",
            offer_line="$499 one-time website purchase, 30 free days of the AI Growth Agent, then optional $299/month; the website remains the client's property.",
            principal_dentist="Dr. Fraserview",
            office_manager="",
        ),
        Lead(
            clinic_name="Billings Bridge Dental Centre",
            city="Ottawa",
            province="ON",
            email="info@adcottawa.com",
            phone="(613) 737-4944",
            website="https://adcottawa.com",
            parent_dso="Independent",
            google_rating=4.9,
            google_review_count=1651,
            cdcp_participating=True,
            score=90,
            tier="A (site unreachable at check; confirm)",
            evidence_hook="1,651 Google reviews, 4.9; site did not load at check",
            keyword_hook="dentist ottawa: 1K-10K, Medium",
            offer_line="$499 one-time website purchase, 30 free days of the AI Growth Agent, then optional $299/month; the website remains the client's property.",
            status=LeadStatus.SCRAPED_RAW,
        ),
    ]


async def cmd_seed(args):
    db, orch = await build_orchestrator(dry_run=True)
    await orch.seed_leads(sample_leads())
    print(f"Seeded {len(sample_leads())} leads.")


async def cmd_run(args):
    db, orch = await build_orchestrator(dry_run=args.dry_run)
    if args.seed:
        await orch.seed_leads(sample_leads())
    await orch.run(interval=args.interval, max_iterations=args.iterations)
    print("Run complete.")


async def cmd_status(args):
    db, _ = await build_orchestrator(dry_run=True)
    from collections import Counter

    # gather all leads
    all_leads = []
    for st in LeadStatus:
        all_leads.extend(await db.list_leads_by_status(st.value))
    counts = Counter(l.status.value for l in all_leads)
    print("Lead counts by status:")
    for st in LeadStatus:
        print(f"  {st.value}: {counts.get(st.value, 0)}")
    print(f"Total: {len(all_leads)}")


async def cmd_triage(args):
    db, orch = await build_orchestrator(dry_run=args.dry_run)
    body = Path(args.file).read_text(encoding="utf-8") if args.file else ""
    reply = InboundReply(lead_id=args.lead_id, from_email=args.from_email or "", subject=args.subject or "", body=body)
    result = await orch.triage.handle_reply(reply)
    print(json.dumps(result.model_dump(mode="json"), indent=2))


async def cmd_confirm_payment(args):
    db, orch = await build_orchestrator(dry_run=True)
    ok = await orch.confirm_payment(args.quote_id)
    print("confirmed" if ok else "not found")


async def cmd_serve(args):
    import uvicorn

    uvicorn.run("api:app", host=args.host, port=args.port, reload=False)


def main():
    parser = argparse.ArgumentParser(description="Sales OS 5-agent pipeline")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("seed-sample")
    p.set_defaults(func=cmd_seed)

    p = sub.add_parser("run")
    p.add_argument("--iterations", type=int, default=3)
    p.add_argument("--interval", type=float, default=1.0)
    p.add_argument("--dry-run", action="store_true", default=True)
    p.add_argument("--seed", action="store_true")
    p.set_defaults(func=cmd_run)

    p = sub.add_parser("status")
    p.set_defaults(func=cmd_status)

    p = sub.add_parser("triage")
    p.add_argument("--lead-id", required=True)
    p.add_argument("--from-email", default="")
    p.add_argument("--subject", default="")
    p.add_argument("--file")
    p.add_argument("--dry-run", action="store_true", default=True)
    p.set_defaults(func=cmd_triage)

    p = sub.add_parser("confirm-payment")
    p.add_argument("--quote-id", required=True)
    p.set_defaults(func=cmd_confirm_payment)

    p = sub.add_parser("serve")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8000)
    p.set_defaults(func=cmd_serve)

    args = parser.parse_args()
    asyncio.run(args.func(args))


if __name__ == "__main__":
    main()
