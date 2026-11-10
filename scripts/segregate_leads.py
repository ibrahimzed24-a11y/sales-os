#!/usr/bin/env python3
"""
Valioz Health — Clinic Leads Segregation & Intelligence Processor.
Segregates clinics into:
1. Cohort A (Live Website): Visibility, GEO, Local 3-Pack, After-hours Intake.
   Rule: Never offer 'Your own custom website'.
2. Cohort B (No Website / Broken Website): Full Custom Website Build + 30d Growth ($499).
   Rule: Includes 'Your own custom website' journey step.
Strict non-DSO hygiene: Excludes dentalcorp, 123Dentist network, and known shared ownership.
Maps time zones for exact 08:00 AM local Canadian dispatch.
"""

import csv
import json
import re
from pathlib import Path

ROOT = Path("/Users/up_2/Valioz Os")
CLINIC_INTEL_CSV = ROOT / "Market research/archive_extracted/Clinic Intelligence (138 leads, scored and verified).csv"
ENRICHED_CSV = ROOT / "sales-os-email-workflow/data/dental-clinics-enriched.csv"
DECISION_MAKERS_CSV = ROOT / "sales-os-email-workflow/data/decision-makers.csv"
OUTPUT_DIR = ROOT / "data/segregated"

# Province to College and Time Zone mapping
PROVINCE_META = {
    "ON": {"college": "RCDSO", "tz": "America/Toronto", "tz_code": "ET", "utc_send": "13:00Z", "cairo_send": "15:00"},
    "QC": {"college": "ODQ", "tz": "America/Toronto", "tz_code": "ET", "utc_send": "13:00Z", "cairo_send": "15:00"},
    "BC": {"college": "BCDCO", "tz": "America/Vancouver", "tz_code": "PT", "utc_send": "15:00Z", "cairo_send": "17:00"},
    "AB": {"college": "CADA", "tz": "America/Edmonton", "tz_code": "MT", "utc_send": "14:00Z", "cairo_send": "16:00"},
    "MB": {"college": "MDA", "tz": "America/Winnipeg", "tz_code": "CT", "utc_send": "14:00Z", "cairo_send": "16:00"},
    "SK": {"college": "CDSS", "tz": "America/Regina", "tz_code": "CST", "utc_send": "14:00Z", "cairo_send": "16:00"},
    "NS": {"college": "PDBNS", "tz": "America/Halifax", "tz_code": "AT", "utc_send": "12:00Z", "cairo_send": "14:00"},
    "NB": {"college": "NBCDS", "tz": "America/Halifax", "tz_code": "AT", "utc_send": "12:00Z", "cairo_send": "14:00"},
    "PE": {"college": "DAPEI", "tz": "America/Halifax", "tz_code": "AT", "utc_send": "12:00Z", "cairo_send": "14:00"},
}

KNOWN_DSO_EXCLUSIONS = {
    "maple ridge family dental": "Affiliated with 123Dentist network on site",
    "123 kerrisdale dental centre": "Known 123Dentist member practice",
    "canada way dental": "Shared ownership with Mulberry / Vancouver City Centre",
    "brush dental church": "Part of 21-clinic multi-site DSO/group",
}

def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-")

def load_csv(path: Path) -> list:
    if not path.exists():
        return []
    with open(path, mode="r", encoding="utf-8-sig", errors="ignore") as f:
        return list(csv.DictReader(f))

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    intel_rows = load_csv(CLINIC_INTEL_CSV)
    enriched_rows = load_csv(ENRICHED_CSV)
    dm_rows = load_csv(DECISION_MAKERS_CSV)
    
    # Map decision makers by normalized clinic name
    dm_map = {}
    for r in dm_rows:
        name_key = r.get("clinic_brand_name", "").strip().lower()
        if name_key:
            dm_map[name_key] = r
            
    # Map enriched logo & URLs
    enriched_map = {}
    for r in enriched_rows:
        name_key = r.get("clinic_brand_name", "").strip().lower()
        if name_key:
            enriched_map[name_key] = r

    all_processed = []
    cohort_a_live = []
    cohort_b_no_site = []
    excluded_dso = []

    for r in intel_rows:
        name = r.get("clinic_brand_name", "").strip()
        if not name:
            continue
        name_lower = name.lower()
        slug = slugify(name)
        
        parent_dso = r.get("parent_dso", "Independent").strip()
        province = (r.get("province") or r.get("province_state") or "ON").strip().upper()
        city = (r.get("city") or "").strip()
        email = (r.get("clinic_email") or "").strip()
        url = (r.get("direct_clinic_url") or "").strip()
        rating = float(r.get("google_rating") or 0)
        reviews = int(float(r.get("google_review_count") or 0))
        cdcp = str(r.get("cdcp_participating") or "").lower() == "true"
        score = int(float(r.get("total_0_100") or 0))
        
        # Enriched metadata lookup
        enr = enriched_map.get(name_lower, {})
        resolved_url = (enr.get("resolved_website_url") or url).strip()
        logo_url = enr.get("clinic_logo_hosted_url") or f"https://raw.githubusercontent.com/ibrahimzed24-a11y/sales-os/main/assets/clinic-logos/{slug}.png"
        
        # Decision maker resolution
        dm = dm_map.get(name_lower, {})
        dm_name = dm.get("decision_maker_name") or r.get("principal_dentists") or r.get("office_manager_name") or ""
        dm_title = dm.get("decision_maker_title") or ("Dentist" if "Dr." in dm_name else ("Practice Manager" if dm_name else "Practice Manager"))
        
        # Determine track & greeting
        if dm_name and "dr." in dm_name.lower():
            # Doctor track
            parts = dm_name.split()
            last_name = parts[-1]
            greeting = f"Dr. {last_name}"
            recipient_track = "doctor_peer_diagnostic"
            address_as = dm_name
        elif dm_name:
            # Office manager track with name
            parts = dm_name.split()
            first_name = parts[0]
            greeting = f"Hi {first_name}"
            recipient_track = "office_manager_administrative"
            address_as = dm_name
        else:
            # Fallback
            greeting = "Hi there"
            address_as = "Practice Manager (name not published)"
            dm_title = "Practice Manager"
            recipient_track = "office_manager_fallback"

        # Time zone info
        tz_meta = PROVINCE_META.get(province, PROVINCE_META["ON"])

        # Reputation badge
        reputation_badge = f"{rating:.1f}★ from {reviews:,} Google reviews" if (rating >= 4.0 and reviews >= 50) else None

        # Check DSO eligibility
        is_dso = parent_dso != "Independent" or name_lower in KNOWN_DSO_EXCLUSIONS
        dso_reason = None
        if parent_dso != "Independent":
            dso_reason = f"Flagged as corporate group: {parent_dso}"
        elif name_lower in KNOWN_DSO_EXCLUSIONS:
            dso_reason = KNOWN_DSO_EXCLUSIONS[name_lower]

        # Determine website presence
        obs = (r.get("evidence_observed") or "").lower()
        st = (r.get("verification_status") or "").lower()
        is_broken = any(k in obs or k in st for k in ["522", "unreachable", "did not load", "does not resolve", "broken", "holding page", "placeholder"])
        has_no_site = not resolved_url or resolved_url.lower() in ["none", "n/a", ""] or "no website" in obs
        
        if is_broken:
            website_state = "broken"
        elif has_no_site:
            website_state = "no_website"
        else:
            website_state = "live"

        clinic_record = {
            "clinic_name": name,
            "slug": slug,
            "city": city,
            "province": province,
            "college": tz_meta["college"],
            "time_zone": tz_meta["tz"],
            "time_zone_code": tz_meta["tz_code"],
            "target_send_utc": tz_meta["utc_send"],
            "target_send_cairo": tz_meta["cairo_send"],
            "email": email,
            "resolved_website_url": resolved_url,
            "hosted_logo_url": logo_url,
            "website_state": website_state,
            "score": score,
            "rating": rating,
            "review_count": reviews,
            "reputation_badge": reputation_badge,
            "cdcp_participating": cdcp,
            "decision_maker_name": address_as,
            "decision_maker_title": dm_title,
            "greeting": greeting,
            "outreach_track": recipient_track,
            "is_independent": not is_dso,
            "dso_exclusion_reason": dso_reason
        }

        all_processed.append(clinic_record)

        if is_dso:
            excluded_dso.append(clinic_record)
        elif website_state == "live":
            clinic_record["cohort"] = "COHORT_A_LIVE_WEBSITE"
            clinic_record["offer_type"] = "patient_journey_optimization_and_geo"
            clinic_record["include_custom_website_step"] = False
            cohort_a_live.append(clinic_record)
        else:
            clinic_record["cohort"] = "COHORT_B_NO_WEBSITE"
            clinic_record["offer_type"] = "custom_website_and_30d_growth_launch"
            clinic_record["include_custom_website_step"] = True
            cohort_b_no_site.append(clinic_record)

    # Sort cohorts by score descending
    cohort_a_live.sort(key=lambda x: x["score"], reverse=True)
    cohort_b_no_site.sort(key=lambda x: x["score"], reverse=True)

    # Save to JSON and CSV
    with open(OUTPUT_DIR / "cohort_a_live_website.json", "w", encoding="utf-8") as f:
        json.dump(cohort_a_live, f, indent=2)
    with open(OUTPUT_DIR / "cohort_b_no_website.json", "w", encoding="utf-8") as f:
        json.dump(cohort_b_no_site, f, indent=2)
    with open(OUTPUT_DIR / "excluded_dso_clinics.json", "w", encoding="utf-8") as f:
        json.dump(excluded_dso, f, indent=2)
    with open(OUTPUT_DIR / "all_clinics_master.json", "w", encoding="utf-8") as f:
        json.dump(all_processed, f, indent=2)

    # Export CSVs for easy human inspection
    def export_csv(data, filename):
        if not data:
            return
        keys = list(data[0].keys())
        with open(OUTPUT_DIR / filename, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(data)

    export_csv(cohort_a_live, "cohort_a_live_website.csv")
    export_csv(cohort_b_no_site, "cohort_b_no_website.csv")
    export_csv(excluded_dso, "excluded_dso_clinics.csv")

    summary = {
        "total_leads_processed": len(all_processed),
        "excluded_dso_count": len(excluded_dso),
        "eligible_independent_total": len(cohort_a_live) + len(cohort_b_no_site),
        "cohort_a_live_website_count": len(cohort_a_live),
        "cohort_b_no_website_count": len(cohort_b_no_site),
    }

    with open(OUTPUT_DIR / "segregation_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print("=== SEGREGATION COMPLETE ===")
    print(json.dumps(summary, indent=2))

if __name__ == "__main__":
    main()
