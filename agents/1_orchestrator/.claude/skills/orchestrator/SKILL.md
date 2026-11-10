---
name: orchestrator
description: Master orchestration of the 5 Valioz Health AI agents, coordinating handovers, enforcing operating cadence, and generating Daily Growth Briefs.
---

# Master Orchestration & Executive Reporting Skill (`/orchestrator`)

Step-by-step procedure for executing the autonomous 5-agent sales cycle, orchestrating sequential handovers, and generating executive reports.

## What to Read First
1. `PROJECT-SUMMARY.txt`
2. `agents/1_orchestrator/CLAUDE.md`
3. `sales-os-email-workflow/canadian_clinics_outreach_tracker.csv`

## Steps in Order

### Step 1: Pre-Flight System Health & Schedule Verification
1. Verify current day: Is today an active outreach day (Tuesday, Wednesday, or Thursday)?
2. Check Hostinger webmail session in Chrome via Browser Outreach Agent (`/browser-outreach`).
3. Verify tracker integrity and count eligible uncontacted inventory.

### Step 2: Trigger Handover Chain
Execute the automated sequential handover:
```bash
python3 agents/1_orchestrator/agent.py --run-daily
```
The Orchestrator executes:
1. **Handover 1 (Lead Intel Agent `/lead-intel`)**: Segregates clinics into Cohort A and Cohort B, filters DSOs, resolves decision makers, and yields 10 uncontacted leads mapped to local time zones.
2. **Handover 2 (Copywriter Agent `/copywriter`)**: Receives the 10 leads, applies DSPy and Terse compression, renders dual-brand 660px table HTML, tailors copy to cohort needs, and writes `manifest.json`.
3. **Handover 3 (Browser Outreach Agent `/browser-outreach`)**: Ingests `manifest.json`, schedules sends for 08:00 AM local clinic time, commits recipient chips in Hostinger webmail, verifies send toasts, and logs dispatch confirmations.
4. **Handover 4 (Pipeline CRM Agent `/pipeline-crm`)**: Updates `canadian_clinics_outreach_tracker.csv` with dual UTC/local timestamps, monitors inbound sentiment, triggers CASL suppressions, and creates $499 proposals for interested leads.

### Step 3: Publish Daily Growth Brief
1. Compile metrics:
   - Date & execution cycle.
   - Cohort breakdown (Cohort A vs Cohort B).
   - Dispatch timeline across Canadian time zones (ET, CT, MT, PT, AT).
   - Reply sentiment & pipeline updates.
2. Save brief into `dist/growth-briefs/Daily_Growth_Brief_<YYYY-MM-DD>.md`.
3. Present executive summary to the Solo Director.

## What a Good Result Looks Like
- Zero manual intervention required for end-to-end cycle.
- Seamless data handoff between all 4 specialist agents without data loss.
- 10 distinct, verified dual-brand emails queued or dispatched at exact local 8:00 AM.
- Executive Daily Growth Brief rendered with actionable pipeline insights.
