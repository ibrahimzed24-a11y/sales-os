# Sales OS — 5-Agent Pipeline (Valioz Health)

Continuous, state-driven sales automation for Canadian independent dental clinics.

## States
`SCRAPED_RAW` → `LEAD_VERIFIED_PRIORITY_A` / `REJECTED_DSO` / `HOLD_SITE_DOWN` → `CAMPAIGN_DISPATCHED` → `QUALIFIED_DEAL` / `SUPPRESSED_CASL` → `INVOICE_SENT` → `DEAL_WON` → `ACTIVE_ONBOARDING` → `RETAINER_COMMITTED`

## Run
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill keys
python main.py seed-sample
python main.py run --iterations 5 --interval 2 --dry-run
python main.py status
python tests/test_pipeline.py
```

FastAPI: `python main.py serve` then open http://127.0.0.1:8000/docs

## Agents
- `agent_intel.py` — DSO filter, URL audit, scoring merge.
- `agent_outreach.py` — CASL-compliant email dispatch with throttling.
- `agent_triage.py` — inbound reply classification and objection handling.
- `agent_proposal.py` — quote + Stripe checkout.
- `agent_lifecycle.py` — onboarding, Daily Growth Brief, day-25 retainer pitch.
