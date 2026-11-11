"""
VALIOZ Health — Strategic Twisting, Rotating Email Scheduler.
Coordinates Canadian time-zone progression (Atlantic to Pacific),
applies multi-vector angle rotation (Demand, Rank, Intake, Benchmark, GEO),
introduces humanized micro-jitter (6-14 min intervals), and enforces provincial caps (max 3/province).
"""

import os
import sys
import json
import random
import hashlib
from datetime import datetime, date, time, timedelta
from typing import Dict, List, Any, Optional
import zoneinfo

# Add root directory to sys.path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import importlib
_copywriter_mod = importlib.import_module("agents.3_copywriter.components")
EmailComponents = _copywriter_mod.EmailComponents

class EmailAngleRotator:
    """
    Strategic psychological angle matrix for subject line and copy twisting.
    Guarantees no two consecutive recipients receive the same pitch angle or subject.
    """
    ANGLES = [
        "DEMAND_SURGE",
        "MAP_RANK_DEFENSE",
        "INTAKE_OPTIMIZATION",
        "PRACTICE_BENCHMARK",
        "AI_OVERVIEW_GEO",
    ]

    SUBJECT_TEMPLATES = {
        "DEMAND_SURGE": [
            "Dr. {doctor_last}, {city} patient search demand audit ({clinic_name})",
            "Growth Audit: local dental search demand in {city} ({clinic_name})",
        ],
        "MAP_RANK_DEFENSE": [
            "{clinic_name} vs local DSO visibility in {city}",
            "Defending {clinic_name}'s Maps 3-Pack rank in {city}",
        ],
        "INTAKE_OPTIMIZATION": [
            "Quick diagnostic note on {clinic_name}'s digital patient flow",
            "After-hours inquiry & intake capture for {clinic_name}",
        ],
        "PRACTICE_BENCHMARK": [
            "Patient acquisition benchmark for {clinic_name} ({city})",
            "Restorative & CDCP inquiry volume in {city} (for {clinic_name})",
        ],
        "AI_OVERVIEW_GEO": [
            "How {city} patients discover {clinic_name} on Google AI Overviews",
            "AI search & conversational discovery audit for {clinic_name}",
        ],
    }

    @classmethod
    def get_angle(cls, index: int) -> str:
        """Deterministically rotate angle based on recipient index."""
        return cls.ANGLES[index % len(cls.ANGLES)]

    @classmethod
    def get_subject(cls, angle: str, clinic: Dict[str, Any], variant_index: int = 0) -> str:
        """Render twisted personalized subject line."""
        templates = cls.SUBJECT_TEMPLATES.get(angle, cls.SUBJECT_TEMPLATES["DEMAND_SURGE"])
        template = templates[variant_index % len(templates)]
        
        doctor_last = clinic.get("doctor_last_name") or clinic.get("contact_person") or "Doctor"
        if doctor_last.lower().startswith("dr."):
            doctor_last = doctor_last[3:].strip()
        if not doctor_last or doctor_last == "Doctor":
            # fallback if no doctor name
            doctor_last = clinic.get("clinic_name", "Doctor")
            template = template.replace("Dr. {doctor_last}, ", "")
            
        clinic_name = clinic.get("clinic_name", "Brampton Dental Arts")
        city = clinic.get("city", "Brampton")

        return template.format(
            doctor_last=doctor_last,
            clinic_name=clinic_name,
            city=city
        )

class CanadianTimeZoneCadence:
    """
    Sunrise Time-Zone Cadence Manager across Canada.
    Targets 08:00 AM local clinic time from Atlantic (08:00 AT) to Pacific (08:00 PT).
    """
    PROVINCE_TIMEZONES = {
        "NL": "America/St_Johns",
        "NS": "America/Halifax",
        "NB": "America/Moncton",
        "PE": "America/Halifax",
        "QC": "America/Montreal",
        "ON": "America/Toronto",
        "MB": "America/Winnipeg",
        "SK": "America/Regina",
        "AB": "America/Edmonton",
        "BC": "America/Vancouver",
        "YT": "America/Whitehorse",
        "NT": "America/Yellowknife",
    }

    # Order of sunrise across Canada (East to West)
    SUNRISE_ORDER = ["NS", "NB", "PE", "NL", "QC", "ON", "MB", "SK", "AB", "BC"]

    @classmethod
    def get_timezone_str(cls, province: str) -> str:
        return cls.PROVINCE_TIMEZONES.get(province.upper().strip(), "America/Toronto")

    @classmethod
    def calculate_local_8am_utc(cls, target_date: date, province: str) -> datetime:
        """Compute the UTC datetime corresponding to 08:00:00 local time in that province."""
        tz_name = cls.get_timezone_str(province)
        local_tz = zoneinfo.ZoneInfo(tz_name)
        # 08:00:00 local time on target_date
        local_dt = datetime.combine(target_date, time(8, 0, 0), tzinfo=local_tz)
        return local_dt.astimezone(zoneinfo.ZoneInfo("UTC"))

    @classmethod
    def add_human_jitter(cls, base_utc: datetime, slot_index: int, min_jitter_min: int = 6, max_jitter_min: int = 14) -> datetime:
        """Introduce natural humanized spacing between dispatches."""
        # Random interval between min_jitter and max_jitter minutes
        jitter_minutes = random.randint(min_jitter_min, max_jitter_min)
        total_delay = timedelta(minutes=(slot_index * jitter_minutes))
        return base_utc + total_delay

class StrategicRotatingScheduler:
    """
    Master Scheduler that generates, tracks, and executes rotating outreach queues.
    """
    QUEUE_BASE_DIR = os.path.join(BASE_DIR, "dist", "outreach-queue")

    def __init__(self):
        os.makedirs(self.QUEUE_BASE_DIR, exist_ok=True)

    def plan_day(self, target_date: Optional[date] = None, max_clinics: int = 10) -> Dict[str, Any]:
        """
        Builds the daily rotating queue:
        1. Selects max 10 clinics adhering to max 3/province.
        2. Orders by Canadian sunrise (Atlantic -> Eastern -> Central -> Mountain -> Pacific).
        3. Assigns twisted angles (DEMAND_SURGE, MAP_RANK_DEFENSE, INTAKE_OPTIMIZATION, etc.).
        4. Calculates exact 08:00 AM local times + human jitter.
        5. Renders native HTML for each clinic.
        """
        if not target_date:
            target_date = date.today()

        date_str = target_date.strftime("%Y-%m-%d")
        day_dir = os.path.join(self.QUEUE_BASE_DIR, date_str)
        os.makedirs(day_dir, exist_ok=True)

        candidates = self._load_candidate_clinics()
        selected = self._balance_by_province(candidates, max_total=max_clinics, max_per_province=3)

        # Sort selected by sunrise order
        selected.sort(key=lambda c: (
            CanadianTimeZoneCadence.SUNRISE_ORDER.index(c.get("province", "ON"))
            if c.get("province", "ON") in CanadianTimeZoneCadence.SUNRISE_ORDER else 99
        ))

        scheduled_items = []
        # Group by province to assign staggered slots per timezone
        province_counters: Dict[str, int] = {}

        for idx, clinic in enumerate(selected):
            prov = clinic.get("province", "ON")
            slot_in_prov = province_counters.get(prov, 0)
            province_counters[prov] = slot_in_prov + 1

            # 1. Rotating Angle & Subject
            angle = EmailAngleRotator.get_angle(idx)
            subject = EmailAngleRotator.get_subject(angle, clinic, variant_index=idx % 2)

            # 2. Timing (08:00 AM Local + Jitter)
            tz_str = CanadianTimeZoneCadence.get_timezone_str(prov)
            base_8am_utc = CanadianTimeZoneCadence.calculate_local_8am_utc(target_date, prov)
            scheduled_utc = CanadianTimeZoneCadence.add_human_jitter(base_8am_utc, slot_in_prov, min_jitter_min=5, max_jitter_min=12)
            
            # Format display local time
            local_tz = zoneinfo.ZoneInfo(tz_str)
            local_display_time = scheduled_utc.astimezone(local_tz).strftime("%I:%M %p %Z")

            # 3. Assemble pure-HTML email prototype
            email_html = EmailComponents.assemble(clinic, step="01-welcome", angle=angle)
            slug = clinic.get("slug") or clinic.get("clinic_name", "clinic").lower().replace(" ", "-")
            html_filename = f"{idx+1:02d}_{slug}_{angle.lower()}.html"
            html_filepath = os.path.join(day_dir, html_filename)
            with open(html_filepath, "w", encoding="utf-8") as f:
                f.write(email_html)

            item = {
                "queue_index": idx + 1,
                "clinic_name": clinic.get("clinic_name"),
                "slug": slug,
                "city": clinic.get("city"),
                "province": prov,
                "timezone": tz_str,
                "target_local_time": local_display_time,
                "scheduled_utc": scheduled_utc.isoformat(),
                "recipient_email": clinic.get("email"),
                "contact_person": clinic.get("contact_person") or clinic.get("doctor_last_name", "Doctor"),
                "angle": angle,
                "subject": subject,
                "status": "QUEUED",
                "html_file": html_filename,
                "html_path": html_filepath,
            }
            scheduled_items.append(item)

        manifest = {
            "date": date_str,
            "generated_at": datetime.now(zoneinfo.ZoneInfo("UTC")).isoformat(),
            "cadence_day": target_date.strftime("%A"),
            "total_clinics": len(scheduled_items),
            "provinces_represented": list(set(item["province"] for item in scheduled_items)),
            "angles_used": list(set(item["angle"] for item in scheduled_items)),
            "schedule": scheduled_items,
        }

        manifest_path = os.path.join(day_dir, "rotated_schedule_manifest.json")
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)

        return manifest

    def get_schedule_status(self, target_date: Optional[date] = None) -> Dict[str, Any]:
        """Read and analyze the current status of the daily schedule."""
        if not target_date:
            target_date = date.today()
        date_str = target_date.strftime("%Y-%m-%d")
        manifest_path = os.path.join(self.QUEUE_BASE_DIR, date_str, "rotated_schedule_manifest.json")

        if not os.path.exists(manifest_path):
            # Plan on the fly if not existing
            return self.plan_day(target_date)

        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        now_utc = datetime.now(zoneinfo.ZoneInfo("UTC"))
        queued_count = sum(1 for s in manifest["schedule"] if s.get("status") == "QUEUED")
        sent_count = sum(1 for s in manifest["schedule"] if s.get("status") == "SENT")

        manifest["live_utc"] = now_utc.isoformat()
        manifest["summary"] = {
            "queued": queued_count,
            "sent": sent_count,
            "total": len(manifest["schedule"]),
        }
        return manifest

    def _load_candidate_clinics(self) -> List[Dict[str, Any]]:
        """Load vetted clinics from existing verified queue or segregated pools."""
        # 1. Check existing daily queue manifest first
        recent_queue_dir = os.path.join(BASE_DIR, "dist", "outreach-queue")
        if os.path.exists(recent_queue_dir):
            dates = sorted([d for d in os.listdir(recent_queue_dir) if os.path.isdir(os.path.join(recent_queue_dir, d))], reverse=True)
            for d in dates:
                m_path = os.path.join(recent_queue_dir, d, "manifest.json")
                if os.path.exists(m_path):
                    try:
                        with open(m_path, "r", encoding="utf-8") as f:
                            data = json.load(f)
                            clinics = data.get("clinics") or []
                            if clinics:
                                return clinics
                    except Exception:
                        pass

        # 2. Check segregated data pools
        pool_path = os.path.join(BASE_DIR, "data", "segregated", "cohort_a_live_website.json")
        if os.path.exists(pool_path):
            try:
                with open(pool_path, "r", encoding="utf-8") as f:
                    clinics = json.load(f)
                    if clinics:
                        return clinics
            except Exception:
                pass

        # 3. Default fallback verified clinic list
        return [
            {
                "clinic_name": "Brampton Dental Arts",
                "slug": "brampton-dental-arts",
                "city": "Brampton",
                "province": "ON",
                "email": "ibrahim.zed24@gmail.com",
                "contact_person": "Dr. Sheikh",
                "doctor_last_name": "Sheikh",
                "resolved_website_url": "https://bramptondentalarts.com/"
            },
            {
                "clinic_name": "Square One Dental",
                "slug": "square-one-dental",
                "city": "Mississauga",
                "province": "ON",
                "email": "info@squareonedental.ca",
                "contact_person": "Dr. Patel",
                "doctor_last_name": "Patel",
                "resolved_website_url": "https://squareonedental.ca/"
            },
            {
                "clinic_name": "Uptown Dental Trafalgar",
                "slug": "uptown-dental-trafalgar",
                "city": "Oakville",
                "province": "ON",
                "email": "contact@uptowndental.ca",
                "contact_person": "Dr. Wong",
                "doctor_last_name": "Wong",
                "resolved_website_url": "https://uptowndental.ca/"
            },
            {
                "clinic_name": "Fremont Village Dental",
                "slug": "fremont-village-dental",
                "city": "Port Coquitlam",
                "province": "BC",
                "email": "care@fremontdental.ca",
                "contact_person": "Dr. Lee",
                "doctor_last_name": "Lee",
                "resolved_website_url": "https://fremontdental.ca/"
            },
            {
                "clinic_name": "123 Kerrisdale Dental Centre",
                "slug": "123-kerrisdale-dental-centre",
                "city": "Vancouver",
                "province": "BC",
                "email": "smile@kerrisdaledental.ca",
                "contact_person": "Dr. Chen",
                "doctor_last_name": "Chen",
                "resolved_website_url": "https://kerrisdaledental.ca/"
            },
            {
                "clinic_name": "Riverside Dental Kamloops",
                "slug": "riverside-dental-kamloops",
                "city": "Kamloops",
                "province": "BC",
                "email": "frontdesk@riversidedental.ca",
                "contact_person": "Dr. Campbell",
                "doctor_last_name": "Campbell",
                "resolved_website_url": "https://riversidedental.ca/"
            },
            {
                "clinic_name": "West Grande Prairie Dental",
                "slug": "west-grande-prairie-dental-westgate",
                "city": "Grande Prairie",
                "province": "AB",
                "email": "hello@westgpdental.ca",
                "contact_person": "Dr. Martin",
                "doctor_last_name": "Martin",
                "resolved_website_url": "https://westgpdental.ca/"
            },
            {
                "clinic_name": "Affinity Dental Mayfield Common",
                "slug": "affinity-dental-mayfield-common",
                "city": "Edmonton",
                "province": "AB",
                "email": "edmonton@affinitydental.ca",
                "contact_person": "Dr. Ross",
                "doctor_last_name": "Ross",
                "resolved_website_url": "https://affinitydental.ca/"
            },
            {
                "clinic_name": "Centre Dentaire Beaconsfield",
                "slug": "centre-dentaire-beaconsfield",
                "city": "Beaconsfield",
                "province": "QC",
                "email": "reception@dentairebeaconsfield.ca",
                "contact_person": "Dr. Tremblay",
                "doctor_last_name": "Tremblay",
                "resolved_website_url": "https://dentairebeaconsfield.ca/"
            },
            {
                "clinic_name": "Summit Dental Halifax",
                "slug": "summit-dental",
                "city": "Halifax",
                "province": "NS",
                "email": "info@summitdentalhalifax.ca",
                "contact_person": "Dr. MacDonald",
                "doctor_last_name": "MacDonald",
                "resolved_website_url": "https://summitdentalhalifax.ca/"
            }
        ]

    def _balance_by_province(self, clinics: List[Dict[str, Any]], max_total: int = 10, max_per_province: int = 3) -> List[Dict[str, Any]]:
        """Filter and select clinics enforcing provincial throttling limits."""
        prov_counts: Dict[str, int] = {}
        selected: List[Dict[str, Any]] = []

        for c in clinics:
            prov = c.get("province", "ON").upper().strip()
            count = prov_counts.get(prov, 0)
            if count < max_per_province:
                selected.append(c)
                prov_counts[prov] = count + 1
                if len(selected) >= max_total:
                    break

        return selected

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="VALIOZ Strategic Twisting & Rotating Email Scheduler")
    parser.add_argument("--plan", action="store_true", help="Generate strategic rotating schedule for the date")
    parser.add_argument("--status", action="store_true", help="Check schedule status")
    parser.add_argument("--date", type=str, default=None, help="Target date YYYY-MM-DD")
    args = parser.parse_args()

    target_d = datetime.strptime(args.date, "%Y-%m-%d").date() if args.date else date.today()
    scheduler = StrategicRotatingScheduler()

    if args.status:
        st = scheduler.get_schedule_status(target_d)
        print(json.dumps(st, indent=2))
    else:
        plan = scheduler.plan_day(target_d)
        print(f"Strategic Rotating Schedule Generated for {plan['date']} ({plan['cadence_day']}):")
        print(f"Total clinics: {plan['total_clinics']} | Provinces: {plan['provinces_represented']}")
        print(f"Angles rotated: {plan['angles_used']}\n")
        for item in plan["schedule"]:
            print(f"[{item['queue_index']:02d}] {item['clinic_name']} ({item['city']}, {item['province']})")
            print(f"     Time: {item['target_local_time']} ({item['timezone']})")
            print(f"     Angle: {item['angle']}")
            print(f"     Subject: {item['subject']}")
            print(f"     HTML: {item['html_file']}\n")
