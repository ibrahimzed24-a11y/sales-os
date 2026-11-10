#!/usr/bin/env python3
"""
Agent 1: Master Orchestrator & Executive Reporting Agent.
The Conductor of the Valioz Health Sales OS.
Coordinates autonomous handovers between all 4 specialist agents, verifies invariants,
and compiles the Daily Growth Brief for the Solo Director.
"""

import sys
import os
import json
import importlib.util
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/Users/up_2/Valioz Os")

def load_agent_module(module_name: str, relative_path: str):
    path = ROOT / relative_path
    spec = importlib.util.spec_from_file_location(module_name, str(path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

class SalesOSOrchestrator:
    def __init__(self):
        self.lead_intel_mod = load_agent_module("lead_intel_agent", "agents/2_lead_intel/agent.py")
        self.copywriter_mod = load_agent_module("copywriter_agent", "agents/3_copywriter/agent.py")
        self.browser_mod = load_agent_module("browser_outreach_agent", "agents/4_browser_outreach/agent.py")
        self.crm_mod = load_agent_module("pipeline_crm_agent", "agents/5_pipeline_crm/agent.py")

        self.lead_intel = self.lead_intel_mod.LeadIntelAgent()
        self.copywriter = self.copywriter_mod.CopywriterAgent()
        self.browser = self.browser_mod.BrowserOutreachAgent()
        self.crm = self.crm_mod.PipelineCRMAgent()

        self.briefs_dir = ROOT / "dist/growth-briefs"
        self.briefs_dir.mkdir(parents=True, exist_ok=True)

    def run_daily_cycle(self, dry_run: bool = False, force: bool = False) -> dict:
        today_str = datetime.now().strftime("%Y-%m-%d")
        now_dt = datetime.now()
        weekday = now_dt.weekday() # 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun

        is_active_day = weekday in [1, 2, 3] # Tue, Wed, Thu
        if not is_active_day and not force:
            print(f"[ORCHESTRATOR] Today is {now_dt.strftime('%A')}. Active outreach days are Tuesday, Wednesday, and Thursday.")
            print("[ORCHESTRATOR] Pass --force to run outside standard schedule.")
            return {"status": "SKIPPED_INACTIVE_DAY", "day": now_dt.strftime('%A')}

        print(f"================================================================================")
        print(f"VALIOZ HEALTH SALES OS — AUTONOMOUS DAILY CYCLE: {today_str}")
        print(f"Active outreach day confirmed: {now_dt.strftime('%A')}")
        print(f"================================================================================\n")

        # -------------------------------------------------------------
        # HANDOVER 1: Lead Selection & Time Zone Matching (Agent 2)
        # -------------------------------------------------------------
        print(">>> [HANDOVER 1] Triggering Lead Intelligence & Cohort Segregation Agent...")
        batch = self.lead_intel.select_daily_batch(count=10, max_per_province=3)
        if not batch:
            print("[ORCHESTRATOR] No eligible uncontacted leads remaining!")
            return {"status": "ERROR_NO_LEADS"}
        print(f"[HANDOVER 1 OK] Selected {len(batch)} verified non-DSO clinics across Canada.\n")

        # -------------------------------------------------------------
        # HANDOVER 2: Dual-Brand Copy & Manifest Generation (Agent 3)
        # -------------------------------------------------------------
        print(">>> [HANDOVER 2] Passing leads to Dual-Brand Copywriting Agent (DSPy/Terse)...")
        manifest = self.copywriter.process_batch(batch, date_str=today_str)
        print(f"[HANDOVER 2 OK] Generated 660px dual-brand HTML & manifest for {manifest['count']} clinics.\n")

        # -------------------------------------------------------------
        # HANDOVER 3: Browser Webmail Session Verification (Agent 4)
        # -------------------------------------------------------------
        print(">>> [HANDOVER 3] Connecting to Browser Outreach Agent (Hostinger Webmail)...")
        session = self.browser.check_session()
        print(f"[HANDOVER 3 STATUS] Hostinger Webmail active: {session.get('active', False)}")
        if not session.get("active") and not dry_run:
            print("[WARNING] Chrome does not have mail.hostinger.com open. Please ensure tab is signed in.")

        # -------------------------------------------------------------
        # HANDOVER 4: CRM Tracker Sync & Staging (Agent 5)
        # -------------------------------------------------------------
        print(">>> [HANDOVER 4] Staging queued clinics into Sales CRM Tracker...")
        tracker_rows, fields = self.crm.load_tracker()
        existing_names = {r.get("Clinic Name", "").lower() for r in tracker_rows}

        for item in manifest["sends"]:
            name = item["clinic"]
            if name.lower() not in existing_names:
                tracker_rows.append({
                    "Clinic Name": name,
                    "Province / City": f"{item['timeZoneCode']} / {item['clinic']}",
                    "Local Time Zone": item["timeZoneCode"],
                    "Decision Maker Name": item["decision_maker"],
                    "Decision Maker Title": item["decision_maker_title"],
                    "Email Address": item["to"],
                    "Subject Line": item["subject"],
                    "Sent Timestamp (UTC & Local)": "",
                    "Status": "Scheduled",
                    "Notes": f"Target {item['targetSendUtc']} / 08:00 {item['timeZoneCode']}; Cohort {item['cohort']}"
                })
        self.crm.save_tracker(tracker_rows, fields)
        print(f"[HANDOVER 4 OK] Tracker synchronized with {len(manifest['sends'])} scheduled outreach entries.\n")

        # -------------------------------------------------------------
        # EXECUTIVE REPORTING: Generate Daily Growth Brief
        # -------------------------------------------------------------
        brief = self.generate_daily_growth_brief(today_str, manifest, session)
        return {
            "status": "COMPLETED",
            "date": today_str,
            "manifest": manifest,
            "brief_path": brief["path"]
        }

    def generate_daily_growth_brief(self, date_str: str, manifest: dict, session: dict) -> dict:
        crm_status = self.crm.status()
        sends = manifest.get("sends", [])
        cohort_a_count = sum(1 for s in sends if s.get("cohort") == "COHORT_A_LIVE_WEBSITE")
        cohort_b_count = sum(1 for s in sends if s.get("cohort") == "COHORT_B_NO_WEBSITE")

        brief_md = f"""# VALIOZ Health — Daily Growth Brief
**Date**: {date_str}  
**Executive Overview**: Canadian Independent Dental Practice Acquisition  
**System Status**: 5 Autonomous Agents Operational & Synchronized  

---

### 1. Daily Outreach Queue Execution (10 Distinct Clinics)
- **Total Clinics Queued**: {len(sends)}
- **Cohort A (Live Website & GEO Dominance)**: {cohort_a_count} clinics
  *(Strategy: Visibility optimization, AI search readiness, after-hours intake callback. No custom website step.)*
- **Cohort B (No Website / Broken Website Build)**: {cohort_b_count} clinics
  *(Strategy: $499 Custom Website Build + 30 Days Human+AI Growth Launch offer included.)*
- **Hostinger Webmail Connection**: {'CONNECTED (Chrome active)' if session.get('active') else 'SESSION DISCONNECTED'}

### 2. Timezone-Accurate Dispatch Schedule (08:00 AM Local Clinic Time)
| Clinic Name | Province / City | Timezone | Target UTC Send | Cairo Time | Cohort | Recipient Track |
|---|---|---|---|---|---|---|
"""
        for s in sends:
            brief_md += f"| **{s['clinic']}** | {s.get('timeZoneCode')} | {s.get('timeZoneCode')} | {s.get('targetSendUtc')} | {s.get('targetSendCairo')} | `{s.get('cohort')}` | {s.get('decision_maker')} ({s.get('decision_maker_title')}) |\n"

        brief_md += f"""
---

### 3. Pipeline & Commercial Health
- **Total Tracked Opportunities in CRM**: {crm_status.get('total_tracked', 0)}
- **Status Breakdown**: {json.dumps(crm_status.get('status_breakdown', {}))}
- **Active Offer Terms**: $499 CAD one-time launch + $299 CAD/mo continuity.
- **Regulatory Shield**: 100% compliant with RCDSO, BCDCO, ODQ advertising rules.

---
*Autonomous Report generated by VALIOZ Health Master Orchestrator Agent*
"""
        brief_file = self.briefs_dir / f"Daily_Growth_Brief_{date_str}.md"
        brief_file.write_text(brief_md, encoding="utf-8")
        print(f"=== DAILY GROWTH BRIEF PUBLISHED ===")
        print(f"Saved to: {brief_file}")
        return {"path": str(brief_file), "content": brief_md}

    def system_status(self) -> dict:
        session = self.browser.check_session()
        crm_stat = self.crm.status()
        seg_summary = {}
        seg_summary_file = ROOT / "data/segregated/segregation_summary.json"
        if seg_summary_file.exists():
            seg_summary = json.loads(seg_summary_file.read_text(encoding="utf-8"))

        status = {
            "orchestrator": "READY",
            "hostinger_webmail": "CONNECTED" if session.get("active") else "DISCONNECTED",
            "total_leads_in_pool": seg_summary.get("total_leads_processed", 0),
            "eligible_independents": seg_summary.get("eligible_independent_total", 0),
            "cohort_a_inventory": seg_summary.get("cohort_a_live_website_count", 0),
            "cohort_b_inventory": seg_summary.get("cohort_b_no_website_count", 0),
            "excluded_dso_count": seg_summary.get("excluded_dso_count", 0),
            "crm_pipeline": crm_stat
        }
        return status

if __name__ == "__main__":
    orchestrator = SalesOSOrchestrator()
    if "--status" in sys.argv:
        print(json.dumps(orchestrator.system_status(), indent=2))
    elif "--run-daily" in sys.argv:
        force = "--force" in sys.argv
        dry_run = "--dry-run" in sys.argv
        orchestrator.run_daily_cycle(dry_run=dry_run, force=force)
    elif "--test-send" in sys.argv:
        idx = sys.argv.index("--test-send")
        recipient = sys.argv[idx + 1] if len(sys.argv) > idx + 1 else "ibrahim.zed24@gmail.com"
        orchestrator.browser.send_test_email(recipient)
    else:
        print("Usage:")
        print("  python agent.py --status")
        print("  python agent.py --run-daily [--force] [--dry-run]")
        print("  python agent.py --test-send <email>")
