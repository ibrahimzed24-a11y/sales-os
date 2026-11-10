---
name: copywriter
description: Generate dual-branded personalized HTML emails and custom proposals using DSPy and Terse, adapted for Cohort A (Live Website) vs Cohort B (No Website) and Canadian dental colleges.
---

# Dual-Brand Copywriting & Proposal Skill (`/copywriter`)

Step-by-step procedure for generating dual-branded HTML emails (5-step sequence) and customized proposals using DSPy and Terse.

## What to Read First
1. `Desktop/valioz /VALIOZ Health Dental Psychology & Copywriting Guide.pdf`
2. `Desktop/valioz /VALIOZ Health Master Sales & Messaging Playbook.pdf`
3. Sourced Keyword Planner metrics in `sales-os-email-workflow/lib/sourced-data.js`

## Steps in Order

### Step 1: Ingest Lead Batch & Apply Terse Compression
1. Receive the 10-clinic batch from the Lead Intel Agent.
2. Utilize `terse` to compress redundant payload structures when communicating or caching clinic data:
```python
import terse
compressed = terse.compress(clinic_batch)
```

### Step 2: Run DSPy Dual-Brand Copy Generator
Execute `agents/3_copywriter/agent.py` to compile the personalized copy:
- Map track: Doctor Track (`Dr. <LastName>`) or Office Manager Track (`Hi <FirstName>` / `Hi there`).
- Check cohort:
  - If `COHORT_A_LIVE_WEBSITE`: Exclude website build step from journey, emphasize AI/GEO and after-hours intake.
  - If `COHORT_B_NO_WEBSITE`: Include step 01 "Your own custom website", frame $499 launch.
- Insert dual-brand header:
  - Valioz logo + Clinic hosted logo (48px height, raw.githubusercontent.com public PNGs).
  - "Prepared for {{clinic_brand_name}}".

### Step 3: Render and Validate 660px Table HTML
1. Render full HTML into `dist/outreach-queue/<date>/<clinic_slug>/01-welcome.html`.
2. Verify HTML guardrails:
   - Max width 660px table layout.
   - 2 images only in header with valid URLs and alt text.
   - Valid CTA link (`https://health.valioz.com/`).
   - Unsubscribe link with encoded email and clinic name.
   - WhatsApp link to `+20 10 93272247`.
   - Keyword Planner disclaimer present in footer.

### Step 4: Write Outreach Manifest
Output `manifest.json` with targets, subjects, local and UTC send times, and relative HTML paths, and hand over to the **Browser Outreach & Reach Agent (`/browser-outreach`)**.

## What a Good Result Looks Like
- Responsive, pixel-perfect 660px HTML passing all email client rendering tests.
- Perfect dual-brand alignment: Valioz logo left, clinic logo right, "Prepared for <Clinic>" label.
- Flawless cohort targeting: no website offer to live-site clinics; custom website offer present for no-site clinics.
- Restraint and clinical professionalism: zero hype, zero spam trigger words, fully college-compliant.
