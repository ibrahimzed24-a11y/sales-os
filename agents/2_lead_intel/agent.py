#!/usr/bin/env python3
"""
Agent 2: Lead Intelligence & Data Segmentation Agent.
Extracts, enriches, and selects daily batches of 10 verified non-DSO clinics.
"""

import json
import csv
import sys
from pathlib import Path

ROOT = Path("/Users/up_2/Valioz Os")
SEGREGATED_DIR = ROOT / "data/segregated"
TRACKER_PATH = ROOT / "sales-os-email-workflow/canadian_clinics_outreach_tracker.csv"

class LeadIntelAgent:
    def __init__(self):
        self.segregated_dir = SEGREGATED_DIR
        self.tracker_path = TRACKER_PATH

    def get_contacted_clinics(self) -> set:
        contacted = set()
        if self.tracker_path.exists():
            with open(self.tracker_path, mode="r", encoding="utf-8-sig", errors="ignore") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    name = row.get("Clinic Name", "").strip()
                    status = row.get("Status", "").strip().lower()
                    if status in ["sent", "scheduled"]:
                        contacted.add(name.lower())
        return contacted

    def select_daily_batch(self, count: int = 10, max_per_province: int = 3, cohort_preference: str = None) -> list:
        contacted = self.get_contacted_clinics()
        
        # Load cohorts
        cohort_a_path = self.segregated_dir / "cohort_a_live_website.json"
        cohort_b_path = self.segregated_dir / "cohort_b_no_website.json"
        
        cohort_a = json.loads(cohort_a_path.read_text()) if cohort_a_path.exists() else []
        cohort_b = json.loads(cohort_b_path.read_text()) if cohort_b_path.exists() else []

        candidates = []
        if cohort_preference == "COHORT_A":
            candidates = cohort_a + cohort_b
        elif cohort_preference == "COHORT_B":
            candidates = cohort_b + cohort_a
        else:
            # Interleave to cover both value propositions
            i, j = 0, 0
            while i < len(cohort_a) or j < len(cohort_b):
                if i < len(cohort_a):
                    candidates.append(cohort_a[i])
                    i += 1
                if j < len(cohort_b):
                    candidates.append(cohort_b[j])
                    j += 1

        selected = []
        province_counts = {}

        for clinic in candidates:
            name = clinic["clinic_name"]
            if name.lower() in contacted:
                continue
            prov = clinic["province"]
            if province_counts.get(prov, 0) >= max_per_province:
                continue
            
            selected.append(clinic)
            province_counts[prov] = province_counts.get(prov, 0) + 1
            if len(selected) >= count:
                break

        return selected

    def run(self, count: int = 10):
        batch = self.select_daily_batch(count=count)
        print(f"=== LEAD INTEL AGENT: Selected {len(batch)} verified uncontacted leads ===")
        for idx, c in enumerate(batch, 1):
            print(f"{idx}. {c['clinic_name']} [{c['cohort']}] - {c['city']}, {c['province']} | DM: {c['decision_maker_name']} ({c['decision_maker_title']}) | Send: {c['target_send_utc']} ({c['time_zone_code']})")
        return batch

if __name__ == "__main__":
    agent = LeadIntelAgent()
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    batch = agent.run(count=count)
