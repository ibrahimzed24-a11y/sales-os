---
name: browser-outreach
description: Autonomous Hostinger Reach / webmail dispatch, recipient chip commitment, timezone-accurate 8:00 AM sending, and inbox triage via browser-harness.
---

# Browser Outreach & Reach Specialist Skill (`/browser-outreach`)

Step-by-step procedure for executing automated email dispatch through Hostinger Webmail, verifying delivery toasts, monitoring inbox replies, and labeling incoming threads.

## What to Read First
1. `dist/outreach-queue/<date>/manifest.json`
2. `PROJECT-SUMMARY.txt` (Hostinger compose and chip resolution mechanics)
3. `sales-os-email-workflow/scripts/send-outreach.py`

## Steps in Order

### Step 1: Pre-Flight Browser & Session Check
1. Ensure Chrome is active and signed into `sales@health.valioz.com` at `https://mail.hostinger.com/`.
2. Verify tab connection with `browser-harness`:
```bash
browser-harness <<'PY'
tabs = list_tabs()
mail_tabs = [t for t in tabs if 'mail.hostinger.com' in t.get('url', '')]
print(f"Hostinger tab active: {len(mail_tabs) > 0}")
PY
```

### Step 2: Test Send (Verification Mode)
Before running production batches, execute a test dual-brand send to the verified test addresses (`ibrahim.zed24@gmail.com` or `mahmoud94yasser@gmail.com`):
```bash
python3 agents/4_browser_outreach/agent.py --test-send ibrahim.zed24@gmail.com
```

### Step 3: Production Dispatch at 08:00 AM Local Clinic Time
1. Read `manifest.json` for target date.
2. For each clinic in the manifest:
   - Calculate target UTC send time (ET: 13:00Z, MT: 14:00Z, PT: 15:00Z, CT: 14:00Z, AT: 12:00Z).
   - If current time < send time, wait until the precise target second.
   - Click "New message".
   - Inject `#to` input with recipient address.
   - Wait 3 seconds, focus `#to`, press `Enter`.
   - Verify input is empty (recipient committed into native chip). If failed, retry Enter once; refuse to proceed without a committed chip.
   - Set `#subject`.
   - Inject rendered dual-brand HTML into `iframe [data-qa="composer-content-body"]`.
   - Click "Send".
   - Wait up to 15 seconds for "Message sent successfully" toast.
   - Hand over sent confirmation to **Sales CRM & Pipeline Agent (`/pipeline-crm`)**.

### Step 4: Inbox Monitoring & Inbound Triage
1. Switch to Hostinger Inbox tab.
2. Scan unread conversations.
3. Categorize incoming sentiment:
   - `POSITIVE_INTEREST`: Reply says "YES" or asks for booking link -> Mark HOT, notify Conductor.
   - `OBJECTION_AGENCY`: Reply mentions existing agency -> Draft Battlecard response.
   - `OBJECTION_COMPLIANCE`: Reply asks about college bylaws -> Draft regulatory response.
   - `CASL_OPTOUT`: Reply asks to stop or unsubscribe -> Hand over to Pipeline Agent for immediate CASL suppression.

## What a Good Result Looks Like
- All due emails dispatched at exactly 08:00 AM local clinic time.
- Recipient chip committed with zero plain-text drops.
- 100% of sent rows verified by Hostinger "Message sent successfully" toast.
- Accurate tracker updates with dual UTC and Local timestamps.
