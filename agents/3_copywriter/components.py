"""
VALIOZ Health — Autonomous Email Component Architecture.
Modern, responsive email components, smart cards, and readability perfection.
Pure white background (#ffffff), zero flat image slices for email body content.
Dual-brand header with public CDN-hosted assets and complete sequence support.
Powered by the verified bulletproof template suite matching the prototype design.
"""

import os
import urllib.parse
from pathlib import Path
from typing import Dict, Any, Optional

BASE_DIR = Path(__file__).resolve().parent.parent.parent
TEMPLATE_DIR = BASE_DIR / "templates" / "valioz-email-suite" / "emails"

class EmailComponents:
    # Public Vercel CDN URLs with universal CORS and standard MIME headers
    VALIOZ_LOGO_URL = "https://osv.nilesupplies.com/assets/valioz-logo-horizontal.png"
    HERO_IMAGE_URL = "https://osv.nilesupplies.com/assets/dental-chair-hero.jpg"
    OPPORTUNITY_CURVE_URL = "https://osv.nilesupplies.com/assets/opportunity-curve.png"
    CLINIC_LOGOS_BASE = "https://osv.nilesupplies.com/assets/clinic-logos"
    BOOKING_URL = "https://health.valioz.com/"

    ANGLE_MAP = {
        "DEMAND_SURGE": "angle-1-demand-surge.html",
        "MAP_RANK_DEFENSE": "angle-2-map-defense.html",
        "INTAKE_OPTIMIZATION": "angle-3-intake-audit.html",
        "PRACTICE_BENCHMARK": "angle-4-benchmark.html",
        "AI_OVERVIEW_GEO": "angle-5-ai-geo.html",
    }

    @classmethod
    def assemble(cls, clinic: Dict[str, Any], step: str = "01-welcome", angle: str = "DEMAND_SURGE") -> str:
        """
        Assemble bulletproof pure-white responsive email prototype.
        Uses the verified sanitizer-proof templates matching Image 6 prototype design.
        """
        clinic_name = clinic.get("clinic_name", "Brampton Dental Arts")
        city = clinic.get("city", "Brampton")
        province = clinic.get("province", "ON")
        email = clinic.get("email", "")
        slug = clinic.get("slug") or clinic_name.lower().replace(" ", "-").replace("'", "")
        logo_url = clinic.get("logo_url") or f"{cls.CLINIC_LOGOS_BASE}/{slug}.png"

        encoded_email = urllib.parse.quote(email)
        encoded_name = urllib.parse.quote(clinic_name)
        unsub_url = f"https://health.valioz.com/unsubscribe/?email={encoded_email}&clinic={encoded_name}"
        booking_url = f"{cls.BOOKING_URL}?clinic={encoded_name}&angle={angle.lower()}"

        template_filename = cls.ANGLE_MAP.get(angle, "angle-1-demand-surge.html")
        template_path = TEMPLATE_DIR / template_filename

        if template_path.exists():
            html = template_path.read_text(encoding="utf-8")
            
            # Clean replacements for template variables
            html = html.replace("{{CLINIC_LOGO_URL}}", logo_url)
            html = html.replace("{{CLINIC_NAME}}", clinic_name)
            html = html.replace("{{CITY}}", city)
            html = html.replace("{{PROVINCE}}", province)
            html = html.replace("{{BOOKING_URL}}", booking_url)
            html = html.replace("{{UNSUBSCRIBE_URL}}", unsub_url)

            # Fallback string replacements
            html = html.replace("Brampton Dental Arts", clinic_name)
            html = html.replace("BRAMPTON", city.upper())
            html = html.replace("Brampton", city)
            return html

        # Fallback inline generation if template directory is unavailable
        return cls._fallback_render(clinic, angle)

    @classmethod
    def _fallback_render(cls, clinic: Dict[str, Any], angle: str) -> str:
        name = clinic.get("clinic_name", "Brampton Dental Arts")
        city = clinic.get("city", "Brampton")
        return f"<!doctype html><html><body><h1>{name} - {city}</h1></body></html>"
