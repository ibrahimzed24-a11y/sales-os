---
name: lead-intel
description: Ingest, enrich, and segregate Canadian dental clinics into Cohort A (Live Website) vs Cohort B (No Website), map time zones, and enforce non-DSO hygiene.
---

# Lead Intelligence & Cohort Segregation Skill (`/lead-intel`)

Step-by-step procedure for executing clinic data enrichment, cohort segregation, and daily lead queuing for Valioz Health.

## What to Read First
1. `Market research/archive_extracted/Clinic Intelligence (138 leads, scored and verified).csv`
2. `sales-os-email-workflow/data/decision-makers.csv`
3. `sales-os-email-workflow/canadian_clinics_outreach_tracker.csv`

## Steps in Order

### Step 1: Run Lead Segregation & Hygiene
Execute the segregation engine to classify clinics into Cohort A and Cohort B, filter out corporate DSOs, and map Canadian time zones:
```bash
python3 scripts/segregate_leads.py
```

### Step 2: Verify Segregation Invariants
Verify the segregation counts in `data/segregated/segregation_summary.json`:
- All `parent_dso != 'Independent'` and blacklisted network members are diverted to `excluded_dso_clinics.json`.
- Clinics with live, functional websites are placed in `cohort_a_live_website.json` (`include_custom_website_step = false`).
- Clinics with broken, missing, or placeholder sites are placed in `cohort_b_no_website.json` (`include_custom_website_step = true`).

### Step 3: Select Today's Queue (10 Distinct Uncontacted Leads)
1. Read `canadian_clinics_outreach_tracker.csv` to identify clinics already marked as `Sent` or `Scheduled`.
2. Select top uncontacted leads (capped at maximum 3 per province to ensure geographic distribution):
   - Balance selection across active cohorts according to current outreach strategy.
   - Match local Canadian time zone (ET, CT, MT, PT, AT) for exact 08:00 AM dispatch.
3. Hand over the validated lead batch to the **Copywriter & Proposal Agent (`/copywriter`)**.

## What a Good Result Looks Like
- A clean JSON array of exactly 10 uncontacted clinics.
- Verified non-DSO flag with true independent status.
- Validated decision maker (`Dr. <LastName>` or `Practice Manager (name not published)`).
- Time zone assigned with exact local 8:00 AM target UTC conversion.
- Clear cohort tag (`COHORT_A_LIVE_WEBSITE` or `COHORT_B_NO_WEBSITE`).
