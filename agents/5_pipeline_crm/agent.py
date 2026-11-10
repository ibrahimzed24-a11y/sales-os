#!/usr/bin/env python3
"""
Agent 5: Sales CRM & Pipeline Documentation Agent.
Maintains tracker integrity, logs dual UTC/local timestamps, handles deal qualification,
generates $499 launch proposals, and enforces CASL compliance.
"""

import sys
import os
import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path("/Users/up_2/Valioz Os")
TRACKER_PATH = ROOT / "sales-os-email-workflow/canadian_clinics_outreach_tracker.csv"
SUPPRESSION_PATH = ROOT / "data/casl_suppressed.json"
PROPOSALS_DIR = ROOT / "dist/proposals"

class PipelineCRMAgent:
    def __init__(self):
        self.tracker_path = TRACKER_PATH
        self.suppression_path = SUPPRESSION_PATH
        self.proposals_dir = PROPOSALS_DIR
        self.proposals_dir.mkdir(parents=True, exist_ok=True)

    def load_tracker(self):
        if not self.tracker_path.exists():
            return [], []
        with open(self.tracker_path, mode="r", newline="", encoding="utf-8-sig", errors="ignore") as f:
            reader = csv.DictReader(f)
            return list(reader), reader.fieldnames

    def save_tracker(self, rows, fieldnames):
        # In-place write to keep file hardlinks intact
        with open(self.tracker_path, mode="w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    def record_sent(self, clinic_name: str, tz_name: str = "America/Toronto", tz_code: str = "ET", note: str = ""):
        rows, fields = self.load_tracker()
        now_utc = datetime.now(timezone.utc)
        try:
            local_tz = ZoneInfo(tz_name)
            local_time = now_utc.astimezone(local_tz)
            time_str = f"{now_utc.strftime('%Y-%m-%dT%H:%M:%SZ')} / {local_time.strftime('%Y-%m-%d %H:%M')} {tz_code}"
        except Exception:
            time_str = now_utc.strftime('%Y-%m-%dT%H:%M:%SZ')

        found = False
        for row in rows:
            if row.get("Clinic Name", "").strip().lower() == clinic_name.strip().lower():
                row["Status"] = "Sent"
                row["Sent Timestamp (UTC & Local)"] = time_str
                existing_notes = row.get("Notes") or ""
                new_note = f"Sent via Browser Outreach Agent; {note}".strip("; ")
                row["Notes"] = f"{existing_notes}; {new_note}".strip("; ")
                found = True
                break

        if not found:
            # Append new record if not previously in tracker
            new_row = {
                "Clinic Name": clinic_name,
                "Province / City": "",
                "Local Time Zone": tz_code,
                "Decision Maker Name": "",
                "Decision Maker Title": "",
                "Email Address": "",
                "Subject Line": "",
                "Sent Timestamp (UTC & Local)": time_str,
                "Status": "Sent",
                "Notes": f"Sent via Browser Outreach Agent; {note}".strip("; ")
            }
            rows.append(new_row)

        self.save_tracker(rows, fields)
        print(f"CRM: Marked '{clinic_name}' as Sent at {time_str}")
        return True

    def suppress_casl(self, clinic_name: str, email: str, reason: str = "Opt-out requested"):
        suppressions = []
        if self.suppression_path.exists():
            suppressions = json.loads(self.suppression_path.read_text(encoding="utf-8"))
        
        suppressions.append({
            "clinic_name": clinic_name,
            "email": email,
            "suppressed_at": datetime.now(timezone.utc).isoformat(),
            "reason": reason
        })
        self.suppression_path.parent.mkdir(parents=True, exist_ok=True)
        self.suppression_path.write_text(json.dumps(suppressions, indent=2), encoding="utf-8")

        # Update tracker status
        rows, fields = self.load_tracker()
        for r in rows:
            if r.get("Clinic Name", "").lower() == clinic_name.lower():
                r["Status"] = "SUPPRESSED_CASL"
                r["Notes"] = f"{r.get('Notes', '')}; CASL Opt-out: {reason}".strip("; ")
        self.save_tracker(rows, fields)
        print(f"CRM: Permanent CASL suppression registered for '{clinic_name}' ({email})")

    def generate_proposal(self, clinic_name: str) -> dict:
        slug = clinic_name.lower().replace(" ", "-").replace("'", "")
        proposal_file = self.proposals_dir / f"proposal_{slug}.md"
        
        proposal_content = f"""# VALIOZ Health — Commercial Proposal & Growth Scope
**Client**: {clinic_name}  
**Prepared By**: VALIOZ Health (health.valioz.com)  
**Date**: {datetime.now().strftime('%B %d, %Y')}  
**Package**: 30-Day Healthcare Launch & Digital Intake Infrastructure  

---

### 1. Executive Summary & Core Deliverables
VALIOZ Health equips independent Canadian dental practices with modern patient-intake infrastructure, protecting your practice against corporate DSO rollups while strictly adhering to provincial dental advertising standards.

**Deliverables Included**:
1. **Custom Healthcare Website / Digital Intake Optimization**:
   - Mobile-first, sub-2-second load times, HIPAA/PIPEDA-conscious design.
   - Operatory chair booking optimization & after-hours automated callback capture.
2. **Local SEO & Google Business Profile Optimization**:
   - Local 3-Pack rank protection against DSO networks.
   - Sourced keyword research and monthly Business Profile updates.
3. **GEO + AI Visibility**:
   - Technical schema markup optimized for Google AI Overviews and conversational assistants.
4. **Branded Patient Education Content**:
   - 8 clinical SEO articles targeting high-value restorative cases (implants, aligners).
   - 8 branded social assets and 6 short-form video explainer scripts.
5. **Human Team + Autonomous AI Growth Agent**:
   - Dedicated healthcare strategist and creative review.
   - Daily Growth Brief delivered to your inbox with competitor & rank monitoring.

---

### 2. Commercial Terms & Asset Ownership
- **One-Time Launch Fee**: **$499 CAD** (Includes complete launch + first 30 days of service).
- **Asset Ownership**: You retain 100% full ownership of your domain, hosting, Google accounts, and creative assets. No hostage platform fees.
- **Ongoing Growth Retainer (Optional)**: After 30 days, continue at **$299 CAD/month** (month-to-month, cancel anytime).

---

### 3. Immediate Activation Link
To confirm your launch spot and begin clinic asset onboarding:
👉 **[Activate 30-Day Launch — $499 CAD](https://buy.stripe.com/valioz_health_launch_499)**  
*(Stripe Secure 256-Bit SSL Checkout)*

---
*VALIOZ Health &bull; 3rd Floor, Nile View Tower, Damietta &bull; WhatsApp: +20 10 93272247*
"""
        proposal_file.write_text(proposal_content, encoding="utf-8")
        print(f"CRM: Generated proposal dossier: {proposal_file}")
        return {
            "clinic_name": clinic_name,
            "proposal_path": str(proposal_file),
            "amount": "$499 CAD",
            "checkout_link": "https://buy.stripe.com/valioz_health_launch_499"
        }

    def status(self) -> dict:
        rows, _ = self.load_tracker()
        counts = {}
        for r in rows:
            st = r.get("Status") or "Unknown"
            counts[st] = counts.get(st, 0) + 1
        return {
            "total_tracked": len(rows),
            "status_breakdown": counts
        }

if __name__ == "__main__":
    crm = PipelineCRMAgent()
    if "--status" in sys.argv:
        print(json.dumps(crm.status(), indent=2))
    elif "--generate-proposal" in sys.argv:
        idx = sys.argv.index("--generate-proposal")
        name = sys.argv[idx + 1] if len(sys.argv) > idx + 1 else "Brampton Dental Arts"
        crm.generate_proposal(name)
    else:
        print("CRM Status:", crm.status())
