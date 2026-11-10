---
name: pipeline-crm
description: Update outreach tracker, synchronize lead states in Sales OS CRM, generate $499 Stripe invoices and audit documentation, and enforce CASL suppression.
---

# Sales CRM & Pipeline Documentation Skill (`/pipeline-crm`)

Step-by-step procedure for managing deal stages, updating the outreach tracker, preparing proposals and Stripe checkout links, and maintaining audit logs.

## What to Read First
1. `sales-os-email-workflow/canadian_clinics_outreach_tracker.csv`
2. `Desktop/valioz /VALIOZ Health Master Sales & Messaging Playbook.pdf`
3. `sales-os-agents/sales_os.db`

## Steps in Order

### Step 1: Update Dispatch Status to 'Sent'
Upon receiving send confirmation from the Browser Outreach Agent:
1. Load `canadian_clinics_outreach_tracker.csv`.
2. Format timestamp string: `<UTC_ISO> / <LOCAL_DATE_TIME> <TZ_CODE>`
3. Set `Status = Sent`.
4. Append execution notes: `Sent via Browser Outreach Agent; Dual-Brand HTML`.
5. Perform an atomic in-place rewrite to preserve filesystem inode hardlinks.

### Step 2: Inbound Triage & Deal Qualification
When an inbound reply arrives:
- If `INTERESTED` ("YES" or inquiry):
  - Transition status to `QUALIFIED_DEAL`.
  - Generate custom proposal dossier and Stripe checkout link ($499 CAD).
  - Notify the Master Orchestrator.
- If `CASL_OPTOUT`:
  - Transition status to `SUPPRESSED_CASL`.
  - Add email and clinic domain to permanent opt-out registry.

### Step 3: Proposal & Checkout Generation
Generate the formal $499 Valioz Health launch proposal:
```bash
python3 agents/5_pipeline_crm/agent.py --generate-proposal "<clinic_name>"
```

### Step 4: Pipeline Health Summary
Produce the daily conversion summary for the Master Orchestrator:
- Total Leads Contacted.
- Total Qualified Deals.
- Uncontacted Inventory Remaining (Cohort A vs Cohort B).
- CASL Suppressions.

## What a Good Result Looks Like
- Real-time tracker accuracy with zero missing timestamps.
- Zero broken hardlinks on `canadian_clinics_outreach_tracker.csv`.
- Instant 100% compliance with CASL opt-out requests.
- Ready-to-send $499 proposals with Stripe checkout integration.
