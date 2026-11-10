#!/usr/bin/env python3
"""
Agent 3: Dual-Brand Copywriting & Proposal Agent.
Powered by DSPy and Terse.
Generates dual-branded 660px table HTML outreach emails and customized proposals.
"""

import sys
import os
import json
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

# Add tools to sys.path for dspy and terse
ROOT = Path("/Users/up_2/Valioz Os")
sys.path.insert(0, str(ROOT / "tools/dspy"))
sys.path.insert(0, str(ROOT / "tools/terse/src"))

try:
    import dspy
except ImportError:
    dspy = None

try:
    import terse
except ImportError:
    terse = None

# Sourced Keyword Planner Snapshot
SNAPSHOT_BARS = [
    {"label": "General dentistry", "range": "100K-1M", "width": 94, "color": "#03A8A4"},
    {"label": "Emergency care", "range": "10K-100K", "width": 52, "color": "#173A55"},
    {"label": "Cosmetic & implants", "range": "10K-100K", "width": 41, "color": "#A5D9D5"},
    {"label": "CDCP inquiries", "range": "10K-100K", "width": 38, "color": "#00AFA5"},
]

class DualBrandTemplateEngine:
    @staticmethod
    def render_email(clinic: dict, step: str = "01-welcome") -> str:
        name = clinic["clinic_name"]
        city = clinic["city"]
        prov = clinic["province"]
        college = clinic.get("college", "Provincial Dental College")
        greeting = clinic.get("greeting", "Hi there")
        cohort = clinic.get("cohort", "COHORT_A_LIVE_WEBSITE")
        is_live = cohort == "COHORT_A_LIVE_WEBSITE"
        logo_url = clinic.get("hosted_logo_url")
        site_url = clinic.get("resolved_website_url") or "https://health.valioz.com/"
        encoded_email = urllib.parse.quote(clinic.get("email") or "")
        encoded_name = urllib.parse.quote(name)
        unsub_url = f"https://health.valioz.com/unsubscribe/?email={encoded_email}&clinic={encoded_name}"
        whatsapp_url = "https://wa.me/201093272247"

        # Lead Copy & Angle
        if is_live:
            lead_copy = (
                f"{greeting}, we took a closer look at how patients discover dental care in <b>{city}</b>. "
                f"{name} already has a live web presence, so the primary opportunity is making sure that local "
                f"visibility turns into high-production booked appointments rather than leaking to corporate DSOs in {prov}."
            )
            journey_items = [
                ("01", "Google Search + Google Business Profile", "Local SEO, treatment keyword dominance, Business Profile optimization, photos, and college-compliant review generation."),
                ("02", "GEO + AI Visibility", "Content structured specifically for Google AI Overviews and conversational assistants, capturing patients before traditional directory lookups."),
                ("03", "Instagram + TikTok Search", "8 branded social assets and 6 short-form video explainers targeting high-value restorative cases (implants, aligners)."),
                ("04", "Content + Measurement", "8 clinical SEO articles, GA4 tracking, and after-hours intake call capture to prevent operatory cancellations.")
            ]
        else:
            lead_copy = (
                f"{greeting}, we took a closer look at how patients discover dental care in <b>{city}</b>. "
                f"We couldn’t load a dedicated modern website for {name} when we checked, which directs prospective "
                f"patients toward nearby corporate dental networks with instant online confirmation."
            )
            journey_items = [
                ("01", "Your Own Custom Website", f"Designed specifically for {name}, mobile-first, loading under 2s, compliant with {college} bylaws, and owned 100% by your practice."),
                ("02", "Google Search + Google Business Profile", "Local SEO, treatment keyword dominance, Business Profile optimization, and local map pack rank protection."),
                ("03", "GEO + AI Visibility", "Structured clinical data for discoverability in AI-powered search engines and patient query matching."),
                ("04", "Instagram + TikTok Search", "8 branded social designs and 6 educational video assets informed by Canadian patient interests."),
                ("05", "Content + Measurement", "Full GA4 analytics, Google Tag Manager, and automated callback intake so front desk staff never miss inquiries.")
            ]

        # Research Card
        rep_badge = clinic.get("reputation_badge")
        cdcp = clinic.get("cdcp_participating")
        card_items = []
        if rep_badge:
            card_items.append(f"<strong>{rep_badge}</strong>")
        if cdcp:
            card_items.append("<span style='color:#008F8D;font-weight:bold;'>Verified CDCP Provider</span>")
        card_items.append("Live web presence analyzed" if is_live else "Website need identified")
        research_card_html = " &bull; ".join(card_items)

        # Build Bar Rows
        bars_html = ""
        for b in SNAPSHOT_BARS:
            bars_html += f"""
            <tr>
              <td width="145" style="font-size:12px;color:#536A76;padding:10px 0;">{b['label']}</td>
              <td style="padding:10px 10px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#EDF3F4;border-radius:10px;">
                  <tr>
                    <td width="{b['width']}%" style="background:{b['color']};height:12px;border-radius:10px;font-size:0;line-height:0;">&nbsp;</td>
                    <td width="{100 - b['width']}%" style="font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>
              </td>
              <td width="60" align="right" style="font-size:12px;font-weight:bold;color:#0F1F33;padding:10px 0;">{b['range']}</td>
            </tr>
            """

        # Build Journey HTML
        journey_html = ""
        for num, title, desc in journey_items:
            journey_html += f"""
            <div style="padding:14px 0;border-bottom:1px solid #E6EDED;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td width="32" valign="top" style="color:#00AFA5;font-size:13px;font-weight:bold;">{num}</td>
                  <td valign="top">
                    <b style="font-size:14px;color:#172C46;">{title}</b>
                    <p style="margin:4px 0 0 0;color:#637782;font-size:12px;line-height:1.55;">{desc}</p>
                  </td>
                </tr>
              </table>
            </div>
            """

        html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Growth Audit Prepared for {name}</title>
</head>
<body style="margin:0;padding:20px 0;background-color:#FFFFFF !important;background:#FFFFFF;color:#172C46;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;" bgcolor="#FFFFFF">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="background-color:#FFFFFF !important;background:#FFFFFF;">
    <tr>
      <td align="center" style="padding:10px 12px 30px 12px;background:#FFFFFF;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="660" style="width:660px;max-width:660px;background-color:#FFFFFF !important;background:#FFFFFF;border:1px solid #E5EDED;border-radius:8px;overflow:hidden;">
          <!-- DUAL-BRAND HEADER -->
          <tr>
            <td style="padding:24px 36px;border-bottom:1px solid #E7EDED;background:#FFFFFF;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="left" valign="middle">
                    <a href="https://health.valioz.com/" target="_blank" style="text-decoration:none;">
                      <img src="https://raw.githubusercontent.com/ibrahimzed24-a11y/sales-os/main/assets/valioz-logo-horizontal.png" alt="VALIOZ Health" height="48" style="height:48px;width:auto;display:block;border:0;">
                    </a>
                  </td>
                  <td align="right" valign="middle">
                    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#8A999E;margin-bottom:4px;font-weight:bold;">Prepared for {name}</div>
                    <a href="{site_url}" target="_blank" style="text-decoration:none;">
                      <img src="{logo_url}" alt="{name}" height="48" style="height:48px;width:auto;display:block;border:0;">
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- HERO SECTION -->
          <tr>
            <td style="padding:34px 36px 20px 36px;background:#FFFFFF;">
              <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:#00AFA5;text-transform:uppercase;margin-bottom:12px;">Growth Audit &bull; {city}, {prov}</div>
              <h1 style="font-size:32px;line-height:1.2;color:#172C46;margin:0 0 16px 0;letter-spacing:-0.8px;">
                More patients are searching in {city}.<br>
                <span style="color:#00AFA5;">Will they book with {name}?</span>
              </h1>
              <p style="font-size:15px;line-height:1.65;color:#526774;margin:0 0 20px 0;">
                {lead_copy}
              </p>

              <!-- RESEARCH BADGE CARD -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#FFFFFF;border:1px solid #E2ECEB;border-left:4px solid #00AFA5;border-radius:6px;margin:20px 0;">
                <tr>
                  <td style="padding:14px 18px;font-size:13px;color:#465D69;line-height:1.5;">
                    {research_card_html}
                  </td>
                </tr>
              </table>

              <!-- SEARCH SNAPSHOT -->
              <div style="margin:28px 0 14px 0;font-size:12px;font-weight:bold;color:#667D88;letter-spacing:0.8px;text-transform:uppercase;">
                Canadian Dental Search Demand Snapshot
              </div>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#FFFFFF;border:1px solid #E2ECEB;border-radius:10px;padding:16px;">
                {bars_html}
              </table>
            </td>
          </tr>

          <!-- PATIENT JOURNEY -->
          <tr>
            <td style="padding:10px 36px 24px 36px;background:#FFFFFF;">
              <h2 style="font-size:22px;color:#172C46;margin:0 0 10px 0;">Imagine your patient intake working for you.</h2>
              <p style="font-size:13px;line-height:1.6;color:#637782;margin:0 0 16px 0;">
                Patients search Google, compare clinics on Maps, verify doctor reputation, and expect instant answers. We protect your geographic radius across the complete patient journey.
              </p>
              <div style="border-top:1px solid #E6EDED;">
                {journey_html}
              </div>
            </td>
          </tr>

          <!-- THE VALIOZ DIFFERENCE (PURE WHITE BACKGROUND WITH CLEAN BORDERS) -->
          <tr>
            <td style="background:#FFFFFF;color:#172C46;padding:28px 36px;border-top:1px solid #E7EDED;border-bottom:1px solid #E7EDED;">
              <div style="font-size:11px;font-weight:bold;letter-spacing:1.8px;color:#00AFA5;text-transform:uppercase;">The VALIOZ Difference</div>
              <h3 style="font-size:22px;margin:8px 0 12px 0;color:#172C46;">Human Healthcare Team.<br><span style="color:#00AFA5;">AI-Powered Growth Engine.</span></h3>
              <p style="font-size:13px;line-height:1.65;color:#526774;margin:0 0 16px 0;">
                You get a dedicated healthcare strategist and creative director, backed by an autonomous AI Growth Agent that tracks competitor movement, monitors 3-pack rankings, and delivers your Daily Growth Brief.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td width="50%" valign="top" style="padding-right:12px;">
                    <b style="color:#172C46;font-size:13px;">Clinical Strategy & Review</b>
                    <p style="color:#637782;font-size:12px;line-height:1.5;margin:4px 0 0 0;">Zero hype or banned discounts. 100% {college} advertising compliant.</p>
                  </td>
                  <td width="50%" valign="top" style="padding-left:12px;">
                    <b style="color:#172C46;font-size:13px;">Daily Growth Brief</b>
                    <p style="color:#637782;font-size:12px;line-height:1.5;margin:4px 0 0 0;">Concise updates on local map rankings, intake bottlenecks, and progress.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- PRICING & OFFER BACKBONE -->
          <tr>
            <td style="padding:32px 36px;background:#FFFFFF;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#FFFFFF;border:1px solid #E2ECEB;border-radius:12px;padding:20px;margin-bottom:24px;">
                <tr>
                  <td>
                    <strong style="font-size:16px;color:#172C46;">Your clinic. Your digital equity.</strong>
                    <p style="font-size:12px;color:#526774;line-height:1.6;margin:6px 0 0 0;">
                      You retain complete, 100% ownership of your domain, hosting, creative assets, and Google profiles. No rented websites, no hostage platforms.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- PRICE CARD (CLEAN WHITE CARD WITH BRAND BORDER) -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#FFFFFF;border:2px solid #00AFA5;border-radius:12px;padding:24px;text-align:center;">
                <tr>
                  <td>
                    <div style="font-size:11px;font-weight:bold;letter-spacing:1.5px;color:#00AFA5;text-transform:uppercase;">Valioz Growth Service</div>
                    <div style="font-size:48px;font-weight:800;color:#172C46;margin:8px 0;"><span style="font-size:24px;vertical-align:top;">$</span>499 <span style="font-size:13px;font-weight:normal;color:#637782;">one-time launch</span></div>
                    <p style="font-size:13px;color:#526774;margin:0 0 14px 0;line-height:1.5;">
                      {'Custom website build +' if not is_live else 'Complete digital intake optimization +'} 30 days of Human + AI Growth Service included.
                    </p>
                    <div style="font-size:12px;color:#637782;border-top:1px solid #E2ECEB;padding-top:10px;">
                      Optional after 30 days: $299/month. Cancel anytime; retain all assets.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- CTA & REPLY BOX -->
              <div style="margin-top:28px;text-align:center;">
                <div style="font-size:18px;font-weight:bold;color:#172C46;margin-bottom:14px;">
                  Would you like this activated for {name}?
                </div>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                  <tr>
                    <td>
                      <a href="https://health.valioz.com/" target="_blank" style="display:inline-block;background:#00AFA5;color:#FFFFFF;text-decoration:none;font-size:16px;font-weight:bold;padding:15px 36px;border-radius:8px;">
                        Book Your Free Growth Audit &rarr;
                      </a>
                    </td>
                  </tr>
                </table>

                <div style="margin:16px auto 0 auto;background:#FFFFFF;border:2px solid #00AFA5;color:#00AFA5;border-radius:8px;padding:12px 24px;display:inline-block;font-size:15px;font-weight:bold;">
                  Or just reply &ldquo;YES&rdquo; to this email
                </div>
                <p style="font-size:12px;color:#788B94;margin:10px 0 0 0;">
                  We will personally review your local map coordinates and send over your diagnostic video.
                </p>
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:24px 36px 36px 36px;border-top:1px solid #E7EDED;background:#FFFFFF;color:#81929A;font-size:11px;line-height:1.65;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td>
                    <b style="color:#566B79;">VALIOZ Health &bull; Healthcare Digital Growth</b><br>
                    Website: <a href="https://health.valioz.com/" style="color:#00AFA5;text-decoration:none;">health.valioz.com</a> &bull; WhatsApp: <a href="{whatsapp_url}" style="color:#00AFA5;text-decoration:none;">+20 10 93272247</a><br>
                    Regional Office: 3rd Floor, Nile View Tower, Damietta, Egypt.<br><br>
                    <strong>Data Disclosure:</strong> Search demand statistics reflect Canada-wide bucketed ranges retrieved via Google Ads Keyword Planner on 2026-11-09, preserved for indicative planning. Individual clinic rankings depend on local factors.<br><br>
                    <strong>Confidentiality & Compliance:</strong> This diagnostic communication is prepared exclusively for {name}. Fully compliant with provincial dental advertising regulations ({college}).<br><br>
                    To discontinue receiving practice intelligence briefings: <a href="{unsub_url}" style="color:#566B79;text-decoration:underline;">Unsubscribe {name}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
        return html

    @staticmethod
    def subject_for_clinic(clinic: dict) -> str:
        name = clinic["clinic_name"]
        dm_name = clinic.get("decision_maker_name", "")
        if dm_name and "Dr." in dm_name:
            last = dm_name.split()[-1]
            return f"Dr. {last}, your {name} growth audit"
        elif dm_name and dm_name != "Practice Manager (name not published)":
            first = dm_name.split()[0]
            return f"{first}, your {name} growth audit"
        else:
            return f"Your {name} growth audit"

class CopywriterAgent:
    def __init__(self):
        self.engine = DualBrandTemplateEngine()

    def process_batch(self, clinic_batch: list, date_str: str = None) -> dict:
        if not date_str:
            date_str = datetime.now().strftime("%Y-%m-%d")
        
        # Use Terse to losslessly compress payloads if logging/storing
        if terse and hasattr(terse, "compress"):
            try:
                compressed_debug = terse.compress({"batch_size": len(clinic_batch), "clinics": clinic_batch})
            except Exception:
                pass

        outreach_dir = ROOT / f"dist/outreach-queue/{date_str}"
        outreach_dir.mkdir(parents=True, exist_ok=True)

        manifest_entries = []

        for clinic in clinic_batch:
            slug = clinic["slug"]
            clinic_folder = outreach_dir / slug
            clinic_folder.mkdir(parents=True, exist_ok=True)

            subject = self.engine.subject_for_clinic(clinic)
            html = self.engine.render_email(clinic, step="01-welcome")
            
            html_file = clinic_folder / "01-welcome.html"
            html_file.write_text(html, encoding="utf-8")

            manifest_entries.append({
                "clinic": clinic["clinic_name"],
                "slug": slug,
                "to": clinic["email"],
                "subject": subject,
                "cohort": clinic["cohort"],
                "decision_maker": clinic["decision_maker_name"],
                "decision_maker_title": clinic["decision_maker_title"],
                "timeZone": clinic["time_zone"],
                "timeZoneCode": clinic["time_zone_code"],
                "targetSendUtc": clinic["target_send_utc"],
                "targetSendCairo": clinic["target_send_cairo"],
                "htmlPath": f"dist/outreach-queue/{date_str}/{slug}/01-welcome.html",
                "status": "QUEUED"
            })

        manifest = {
            "date": date_str,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "count": len(manifest_entries),
            "sends": manifest_entries
        }

        manifest_file = outreach_dir / "manifest.json"
        manifest_file.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

        print(f"=== COPYWRITER AGENT: Generated {len(manifest_entries)} Dual-Brand Emails ===")
        print(f"Manifest written to: {manifest_file}")
        return manifest

if __name__ == "__main__":
    # Test generation with batch from LeadIntelAgent
    import importlib.util
    spec = importlib.util.spec_from_file_location("lead_intel_agent", str(ROOT / "agents/2_lead_intel/agent.py"))
    lead_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(lead_module)
    
    intel = lead_module.LeadIntelAgent()
    batch = intel.select_daily_batch(count=10)
    copywriter = CopywriterAgent()
    manifest = copywriter.process_batch(batch)
