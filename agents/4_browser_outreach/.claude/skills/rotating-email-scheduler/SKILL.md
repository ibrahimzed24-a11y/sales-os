---
name: rotating-email-scheduler
description: Strategic Twisting & Rotating Email Scheduler for Canadian dental outreach. Enforces 08:00 AM local sunrise cadence (AT -> PT), multi-vector angle rotation, humanized jitter (6-14 min), and provincial quality caps.
---

# Strategic Twisting & Rotating Email Scheduler

## Purpose & Overview
The Strategic Twisting & Rotating Email Scheduler coordinates cold email outreach for VALIOZ Health across Canadian dental practices. It eliminates spam footprint, IP throttling, and repetitive pitching through continuous multi-vector rotation.

## Core Rules & Non-Negotiables
1. **Sunrise Cadence (East to West)**:
   - Target send time is strictly **08:00 AM in the clinic's local time zone**.
   - Sequence follows Canadian sunrise:
     - Atlantic Time (AT / America/Halifax): 08:00 AM AT = 12:00 UTC
     - Eastern Time (ET / America/Toronto): 08:00 AM ET = 13:00 UTC
     - Central Time (CT / America/Winnipeg): 08:00 AM CT = 14:00 UTC
     - Mountain Time (MT / America/Edmonton): 08:00 AM MT = 15:00 UTC
     - Pacific Time (PT / America/Vancouver): 08:00 AM PT = 16:00 UTC
2. **Multi-Vector Pitch Angle Twisting**:
   - Consecutive recipients NEVER receive identical subject lines or pitch angles.
   - Cycle through 5 distinct psychological hooks:
     - `DEMAND_SURGE`: Local search volume focus (~18.4K/mo) and intent.
     - `MAP_RANK_DEFENSE`: Google Maps 3-Pack rank defense against corporate DSOs (+37% map discovery).
     - `INTAKE_OPTIMIZATION`: Digital patient flow, after-hours intake call capture, mobile booking.
     - `PRACTICE_BENCHMARK`: Comparative restorative treatment volumes & CDCP inquiries.
     - `AI_OVERVIEW_GEO`: Google AI Overviews and modern voice/AI conversational discovery.
3. **Humanized Micro-Jitter (Anti-Spam)**:
   - Never burst-send emails.
   - Stagger consecutive dispatches within each time window with **6 to 14 minutes** of randomized jitter.
4. **Provincial Throttling & Daily Cap**:
   - Max **10 distinct clinics** per active outreach day (Tue, Wed, Thu).
   - Max **3 clinics per province** (e.g. 3 ON, 3 BC, 2 AB, 2 QC).
5. **Pure-White Native HTML Template (Zero Image Slices)**:
   - Body content must NEVER be sent as image slices.
   - Background is pure white (`#ffffff`).
   - Assets served from fast public Vercel CDN (`https://osv.nilesupplies.com/assets/...`).
   - Dual-brand header with VALIOZ Health logo on the left, divider `|`, clinic logo on the right, and `Growth Audit` badge.

## CLI Usage
```bash
# Plan today's strategically rotated queue
python3 agents/4_browser_outreach/scheduler.py --plan

# Check schedule status and live timezone progression
python3 agents/4_browser_outreach/scheduler.py --status

# Plan for a specific future active day (e.g. next Tuesday)
python3 agents/4_browser_outreach/scheduler.py --plan --date 2026-11-17
```

## API Endpoints
- `GET /api/scheduler` — Fetches today's rotated schedule manifest, live timezone progress, and clinic angles.
- `POST /api/scheduler` with `{ "action": "generate", "date": "YYYY-MM-DD" }` — Triggers schedule generation.
