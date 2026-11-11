"""
Valioz Health - Autonomous Email Component Architecture.
Builds pure-HTML/CSS email components as a responsive, accessible prototype.
Pure white background (#ffffff), zero flat image slices for email body content.
Dual-brand header with public CDN-hosted assets.
"""

import urllib.parse
from typing import Dict, Any, Optional

class EmailComponents:
    # Public Vercel CDN URLs with universal CORS and standard MIME headers
    VALIOZ_LOGO_URL = "https://osv.nilesupplies.com/assets/valioz-logo-horizontal.png"
    HERO_IMAGE_URL = "https://osv.nilesupplies.com/assets/dental-chair-hero.jpg"
    CLINIC_LOGOS_BASE = "https://osv.nilesupplies.com/assets/clinic-logos"
    BOOKING_URL = "https://health.valioz.com/"

    @classmethod
    def header(cls, clinic_name: str, clinic_logo_url: str, clinic_site: str = "https://health.valioz.com/") -> str:
        """Dual-Brand Header Component with Growth Audit badge."""
        logo_img = (
            f'<img src="{clinic_logo_url}" height="32" alt="{clinic_name}" '
            f'style="height:32px;max-width:180px;width:auto;display:block;border:0;object-fit:contain;">'
            if clinic_logo_url else
            f'<span style="font-size:14px;font-weight:700;color:#172C46;font-family:Arial,sans-serif;">{clinic_name}</span>'
        )

        return f"""
        <!-- COMPONENT: Dual-Brand Header -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-bottom:1px solid #EEF3F4;padding-bottom:18px;margin-bottom:24px;">
          <tr>
            <td valign="middle" align="left">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right:12px;">
                    <a href="https://valioz.com/" target="_blank" style="text-decoration:none;">
                      <img src="{cls.VALIOZ_LOGO_URL}" height="32" alt="VALIOZ Health" style="height:32px;width:auto;display:block;border:0;">
                    </a>
                  </td>
                  <td valign="middle" style="padding-right:12px;color:#CBD5E1;font-size:22px;font-weight:300;line-height:1;">|</td>
                  <td valign="middle">
                    <a href="{clinic_site}" target="_blank" style="text-decoration:none;">
                      {logo_img}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
            <td valign="middle" align="right" class="hide-mobile">
              <div style="background-color:#E6F8F7;border-radius:20px;padding:6px 14px;font-size:12px;font-weight:700;color:#008E91;letter-spacing:0.3px;white-space:nowrap;display:inline-block;">
                📊 Growth Audit
              </div>
            </td>
          </tr>
        </table>
        """

    @classmethod
    def hero(cls, clinic_name: str, city: str, angle: str = "DEMAND_SURGE", booking_url: str = None) -> str:
        """Two-Column Hero Insights Component with Operatory Photo."""
        url = booking_url or cls.BOOKING_URL
        city_upper = (city or "Local").upper()

        # Strategic Angle Twisting for Headline & Lead
        if angle == "MAP_RANK_DEFENSE":
            eyebrow = f"{city_upper} LOCAL RANK &amp; 3-PACK DEFENSE"
            headline = f'Defending <span style="color:#00AFA5;">{clinic_name}</span> against corporate rollups in {city}.'
            lead = f"Here is how {clinic_name}'s Google Maps footprint benchmarks against private and DSO practices in {city}."
        elif angle == "INTAKE_OPTIMIZATION":
            eyebrow = f"{city_upper} DIGITAL INTAKE AUDIT"
            headline = f'Converting local patient interest into booked chairs in <span style="color:#00AFA5;">{city}.</span>'
            lead = f"A fast diagnostic of {clinic_name}'s inquiry-to-appointment conversion and after-hours patient capture."
        elif angle == "PRACTICE_BENCHMARK":
            eyebrow = f"{city_upper} PRACTICE ACQUISITION BENCHMARK"
            headline = f'High-production dental demand in <span style="color:#00AFA5;">{city}.</span>'
            lead = f"Comparative patient discovery metrics and restorative treatment volume benchmarks for {clinic_name}."
        else: # DEMAND_SURGE (Default)
            eyebrow = f"{city_upper} MARKET INSIGHTS"
            headline = f'More patients are searching for dental care in <span style="color:#00AFA5;">{city}.</span>'
            lead = f"Here's a quick growth audit for {clinic_name} and what it means for your next stage of growth."

        return f"""
        <!-- COMPONENT: Two-Column Hero -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:28px;">
          <tr>
            <td class="col-stack hero-text-col" width="58%" valign="middle" style="padding-right:16px;">
              <div style="font-size:11px;font-weight:800;color:#00AFA5;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">
                {eyebrow}
              </div>
              <h1 style="font-size:26px;line-height:1.22;font-weight:800;color:#172C46;margin:0 0 12px 0;letter-spacing:-0.5px;">
                {headline}
              </h1>
              <p style="font-size:14px;line-height:1.55;color:#4A5E6B;margin:0 0 20px 0;">
                {lead}
              </p>
              <div>
                <a href="{url}" target="_blank" style="background-color:#00AFA5;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:24px;display:inline-block;box-shadow:0 4px 12px rgba(0,175,165,0.28);">
                  View Your Full Growth Audit &rarr;
                </a>
              </div>
            </td>
            <td class="col-stack hero-img-col" width="42%" valign="middle" align="center" style="padding-left:8px;">
              <img src="{cls.HERO_IMAGE_URL}" alt="Modern Dental Clinic Operatory" style="width:100%;max-width:260px;height:auto;border-radius:14px;display:block;border:0;">
            </td>
          </tr>
        </table>
        """

    @classmethod
    def metrics_grid(cls, city: str, angle: str = "DEMAND_SURGE") -> str:
        """Three Stat Cards Component."""
        stat_1_val = "~18.4K" if angle != "INTAKE_OPTIMIZATION" else "94.2%"
        stat_1_lbl = "Local Search Demand" if angle != "INTAKE_OPTIMIZATION" else "Mobile Discovery"
        stat_1_sub = f"Dental services in {city}" if angle != "INTAKE_OPTIMIZATION" else f"Patients searching via phone in {city}"

        return f"""
        <!-- COMPONENT: Metrics Grid (3 Stat Cards) -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:28px;">
          <tr>
            <td class="col-stack" width="32%" valign="top" style="padding-right:6px;">
              <div style="background-color:#F0F8F9;border:1px solid #DDEEF0;border-radius:12px;padding:16px 14px;min-height:96px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td width="24" valign="middle">
                      <span style="display:inline-block;width:22px;height:22px;line-height:22px;border-radius:50%;background:#E1F3F4;text-align:center;font-size:11px;">🔍</span>
                    </td>
                    <td valign="middle" style="padding-left:6px;font-size:11px;font-weight:700;color:#556C7A;">
                      {stat_1_lbl}
                    </td>
                  </tr>
                </table>
                <div style="font-size:22px;font-weight:800;color:#172C46;margin:10px 0 2px 0;">
                  {stat_1_val} <span style="font-size:11px;font-weight:600;color:#788F9D;">/mo</span>
                </div>
                <div style="font-size:10px;color:#788F9D;line-height:1.3;">
                  {stat_1_sub}
                </div>
              </div>
            </td>
            <td class="col-stack" width="32%" valign="top" style="padding:0 3px;">
              <div style="background-color:#F0F8F9;border:1px solid #DDEEF0;border-radius:12px;padding:16px 14px;min-height:96px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td width="24" valign="middle">
                      <span style="display:inline-block;width:22px;height:22px;line-height:22px;border-radius:50%;background:#E1F3F4;text-align:center;font-size:11px;">📍</span>
                    </td>
                    <td valign="middle" style="padding-left:6px;font-size:11px;font-weight:700;color:#556C7A;">
                      Map Searches
                    </td>
                  </tr>
                </table>
                <div style="font-size:22px;font-weight:800;color:#00AFA5;margin:10px 0 2px 0;">
                  +37% &nearr;
                </div>
                <div style="font-size:10px;color:#788F9D;line-height:1.3;">
                  vs. last 3 months
                </div>
              </div>
            </td>
            <td class="col-stack" width="32%" valign="top" style="padding-left:6px;">
              <div style="background-color:#F0F8F9;border:1px solid #DDEEF0;border-radius:12px;padding:16px 14px;min-height:96px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td width="24" valign="middle">
                      <span style="display:inline-block;width:22px;height:22px;line-height:22px;border-radius:50%;background:#E1F3F4;text-align:center;font-size:11px;">📅</span>
                    </td>
                    <td valign="middle" style="padding-left:6px;font-size:11px;font-weight:700;color:#556C7A;">
                      Booking Intent
                    </td>
                  </tr>
                </table>
                <div style="margin:10px 0 4px 0;">
                  <span style="background-color:#E2F7EB;color:#00A86B;font-weight:800;font-size:12px;padding:3px 10px;border-radius:12px;display:inline-block;">High</span>
                </div>
                <div style="font-size:10px;color:#788F9D;line-height:1.3;">
                  Implants &bull; Invisalign &bull; Emergency
                </div>
              </div>
            </td>
          </tr>
        </table>
        """

    @classmethod
    def opportunities(cls) -> str:
        """Key Opportunities Component (3 Structured Focus Cards)."""
        return """
        <!-- COMPONENT: Key Opportunities -->
        <div style="margin-bottom:28px;">
          <h2 style="font-size:18px;font-weight:800;color:#172C46;margin:0 0 14px 0;letter-spacing:-0.3px;">
            Your Key Opportunities
          </h2>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td class="col-stack" width="32%" valign="top" style="padding-right:6px;">
                <div style="background-color:#FFFFFF;border:1px solid #E6EFF0;border-radius:12px;padding:16px 14px;min-height:130px;">
                  <div style="width:32px;height:32px;line-height:32px;border-radius:8px;background-color:#EBF9F8;color:#00AFA5;font-weight:800;font-size:16px;text-align:center;margin-bottom:10px;">
                    G
                  </div>
                  <div style="font-size:13px;font-weight:700;color:#172C46;margin-bottom:6px;line-height:1.3;">
                    Stronger Local Visibility
                  </div>
                  <div style="font-size:11px;color:#607784;line-height:1.45;">
                    Improve your Maps presence and "near me" rankings.
                  </div>
                </div>
              </td>
              <td class="col-stack" width="32%" valign="top" style="padding:0 3px;">
                <div style="background-color:#FFFFFF;border:1px solid #E6EFF0;border-radius:12px;padding:16px 14px;min-height:130px;">
                  <div style="width:32px;height:32px;line-height:32px;border-radius:8px;background-color:#EFF4FE;color:#3B82F6;font-weight:800;font-size:16px;text-align:center;margin-bottom:10px;">
                    ✦
                  </div>
                  <div style="font-size:13px;font-weight:700;color:#172C46;margin-bottom:6px;line-height:1.3;">
                    More High-Value Patients
                  </div>
                  <div style="font-size:11px;color:#607784;line-height:1.45;">
                    Capture demand for implants, Invisalign, and cosmetic care.
                  </div>
                </div>
              </td>
              <td class="col-stack" width="32%" valign="top" style="padding-left:6px;">
                <div style="background-color:#FFFFFF;border:1px solid #E6EFF0;border-radius:12px;padding:16px 14px;min-height:130px;">
                  <div style="width:32px;height:32px;line-height:32px;border-radius:8px;background-color:#F5EEFD;color:#8B5CF6;font-weight:800;font-size:16px;text-align:center;margin-bottom:10px;">
                    📊
                  </div>
                  <div style="font-size:13px;font-weight:700;color:#172C46;margin-bottom:6px;line-height:1.3;">
                    Turn Interest into Bookings
                  </div>
                  <div style="font-size:11px;color:#607784;line-height:1.45;">
                    A faster, smoother digital patient journey.
                  </div>
                </div>
              </td>
            </tr>
          </table>
        </div>
        """

    @classmethod
    def demand_and_opportunity(cls, clinic_name: str) -> str:
        """Two-Column Demand Progress Bars & Opportunity Dark Card with SVG Trend."""
        return f"""
        <!-- COMPONENT: Demand Progress & Opportunity Card -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:28px;">
          <tr>
            <td class="col-stack" width="50%" valign="top" style="padding-right:8px;">
              <div style="background-color:#FFFFFF;border:1px solid #E6EFF0;border-radius:12px;padding:18px 16px;min-height:190px;">
                <div style="font-size:12px;font-weight:800;color:#172C46;margin-bottom:14px;">
                  Canadian Dental Search Demand
                </div>
                
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:10px;">
                  <tr>
                    <td align="left" style="font-size:11px;font-weight:600;color:#2D4352;padding-bottom:4px;">General dentistry</td>
                    <td align="right" style="font-size:11px;font-weight:700;color:#00AFA5;padding-bottom:4px;">100K &ndash; 1M <span style="font-size:9px;color:#788F9D;">/mo</span></td>
                  </tr>
                  <tr>
                    <td colspan="2" style="background-color:#EDF5F5;border-radius:4px;height:6px;overflow:hidden;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="94%" style="background-color:#00AFA5;height:6px;border-radius:4px;"><tr><td></td></tr></table>
                    </td>
                  </tr>
                </table>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:10px;">
                  <tr>
                    <td align="left" style="font-size:11px;font-weight:600;color:#2D4352;padding-bottom:4px;">Emergency care</td>
                    <td align="right" style="font-size:11px;font-weight:700;color:#173A55;padding-bottom:4px;">10K &ndash; 100K <span style="font-size:9px;color:#788F9D;">/mo</span></td>
                  </tr>
                  <tr>
                    <td colspan="2" style="background-color:#EDF5F5;border-radius:4px;height:6px;overflow:hidden;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="52%" style="background-color:#173A55;height:6px;border-radius:4px;"><tr><td></td></tr></table>
                    </td>
                  </tr>
                </table>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:10px;">
                  <tr>
                    <td align="left" style="font-size:11px;font-weight:600;color:#2D4352;padding-bottom:4px;">Cosmetic & implants</td>
                    <td align="right" style="font-size:11px;font-weight:700;color:#3BA59F;padding-bottom:4px;">10K &ndash; 100K <span style="font-size:9px;color:#788F9D;">/mo</span></td>
                  </tr>
                  <tr>
                    <td colspan="2" style="background-color:#EDF5F5;border-radius:4px;height:6px;overflow:hidden;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="41%" style="background-color:#7EDAD4;height:6px;border-radius:4px;"><tr><td></td></tr></table>
                    </td>
                  </tr>
                </table>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td align="left" style="font-size:11px;font-weight:600;color:#2D4352;padding-bottom:4px;">CDCP inquiries</td>
                    <td align="right" style="font-size:11px;font-weight:700;color:#00AFA5;padding-bottom:4px;">10K &ndash; 100K <span style="font-size:9px;color:#788F9D;">/mo</span></td>
                  </tr>
                  <tr>
                    <td colspan="2" style="background-color:#EDF5F5;border-radius:4px;height:6px;overflow:hidden;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="38%" style="background-color:#00AFA5;height:6px;border-radius:4px;"><tr><td></td></tr></table>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
            <td class="col-stack" width="50%" valign="top" style="padding-left:8px;">
              <div style="background-color:#0F2438;border-radius:12px;padding:20px 18px;min-height:190px;color:#FFFFFF;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
                  <tr>
                    <td valign="middle" style="color:#00F0DB;font-size:14px;padding-right:6px;">🎯</td>
                    <td valign="middle" style="color:#00F0DB;font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">
                      The Opportunity
                    </td>
                  </tr>
                </table>
                <p style="font-size:13px;line-height:1.55;color:#E1E9EE;margin:0 0 16px 0;">
                  Patients are already looking. The next step is making <b style="color:#FFFFFF;">{clinic_name}</b> the easiest choice to book.
                </p>
                <div style="padding-top:4px;">
                  <svg width="100%" height="46" viewBox="0 0 240 46" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 38C40 38 60 28 90 28C120 28 140 16 170 16C200 16 215 8 236 4" stroke="#00F0DB" stroke-width="2.5" stroke-linecap="round"/>
                    <circle cx="90" cy="28" r="3.5" fill="#00F0DB"/>
                    <circle cx="170" cy="16" r="3.5" fill="#00F0DB"/>
                    <circle cx="236" cy="4" r="4.5" fill="#FFFFFF" stroke="#00F0DB" stroke-width="2"/>
                  </svg>
                </div>
              </div>
            </td>
          </tr>
        </table>
        """

    @classmethod
    def valioz_difference(cls) -> str:
        """The VALIOZ Difference Bar Component."""
        return """
        <!-- COMPONENT: The VALIOZ Difference -->
        <div style="background-color:#F7FAFB;border:1px solid #E6EFF0;border-radius:10px;padding:12px 16px;margin-bottom:32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td class="col-stack" valign="middle" style="padding-right:12px;white-space:nowrap;">
                <span style="font-size:12px;font-weight:800;color:#172C46;letter-spacing:0.3px;">The VALIOZ Difference</span>
              </td>
              <td class="col-stack" valign="middle" align="center" style="padding:0 6px;color:#788F9D;font-size:11px;">
                <span style="color:#00AFA5;font-weight:bold;">👥</span> A dedicated healthcare team
              </td>
              <td valign="middle" align="center" class="hide-mobile" style="padding:0 4px;color:#00AFA5;font-weight:bold;font-size:12px;">+</td>
              <td class="col-stack" valign="middle" align="center" style="padding:0 6px;color:#788F9D;font-size:11px;">
                <span style="color:#00AFA5;font-weight:bold;">🤖</span> An AI Growth Agent working daily
              </td>
              <td valign="middle" align="center" class="hide-mobile" style="padding:0 4px;color:#00AFA5;font-weight:bold;font-size:12px;">+</td>
              <td class="col-stack" valign="middle" align="center" style="padding:0 6px;color:#788F9D;font-size:11px;">
                <span style="color:#00AFA5;font-weight:bold;">📈</span> Clear results &amp; ongoing insights
              </td>
            </tr>
          </table>
        </div>
        """

    @classmethod
    def primary_cta(cls, booking_url: str = None) -> str:
        """Prominent CTA Button Component matching prototype with calendar icon."""
        url = booking_url or cls.BOOKING_URL
        return f"""
        <!-- COMPONENT: Primary Call To Action -->
        <div style="text-align:center;margin:32px 0 20px 0;">
          <a href="{url}" target="_blank" style="background-color:#00AFA5;color:#ffffff;font-size:16px;font-weight:800;text-decoration:none;padding:16px 36px;border-radius:28px;display:inline-block;box-shadow:0 6px 18px rgba(0,175,165,0.28);letter-spacing:0.3px;">
            📅 Book Your Free Growth Audit &rarr;
          </a>
        </div>
        """

    @classmethod
    def reply_and_footer(cls, clinic_name: str, unsub_url: str) -> str:
        """Fast Reply Prompt & Legal Dual-Brand Footer Component."""
        return f"""
        <!-- COMPONENT: Fast Reply Prompt & Legal Footer -->
        <div style="text-align:center;font-size:13px;color:#556C7A;margin:0 0 28px 0;line-height:1.5;">
          Or simply reply <b style="color:#172C46;">&ldquo;YES&rdquo;</b> to this email, and we'll send you the full diagnostic video.
        </div>

        <div style="border-top:1px solid #EAEFEF;border-bottom:1px solid #EAEFEF;padding:14px 4px;margin-bottom:16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td valign="middle" align="left" class="col-stack" style="font-size:11px;color:#172C46;">
                <b style="color:#00AFA5;">VALIOZ Health</b> <span style="color:#CBD6DA;padding:0 6px;">|</span> Healthcare Digital Growth
              </td>
              <td valign="middle" align="right" class="col-stack" style="font-size:11px;color:#556C7A;">
                🌐 <a href="https://health.valioz.com/" target="_blank" style="color:#556C7A;text-decoration:none;">health.valioz.com</a>
                <span style="padding:0 8px;"></span>
                ✉️ <a href="mailto:sales@health.valioz.com" style="color:#556C7A;text-decoration:none;">sales@health.valioz.com</a>
              </td>
            </tr>
          </table>
        </div>

        <div style="text-align:center;font-size:11px;line-height:1.55;color:#8B9FA8;">
          This brief is prepared exclusively for {clinic_name}. Data reflects Canada-wide ranges from Google Ads Keyword Planner (2026-11-09) and is for planning purposes only. &nbsp;|&nbsp; <a href="{unsub_url}" style="color:#8B9FA8;text-decoration:underline;">Unsubscribe</a>
        </div>
        """

    @classmethod
    def assemble(cls, clinic: Dict[str, Any], step: str = "01-welcome", angle: str = "DEMAND_SURGE") -> str:
        """Assemble all modular components into a responsive pure-white email."""
        name = clinic.get("clinic_name", "Brampton Dental Arts")
        city = clinic.get("city", "Brampton")
        slug = clinic.get("slug", "brampton-dental-arts")
        email = clinic.get("email", "")
        
        # Hosted logos on Vercel CDN
        logo_url = clinic.get("hosted_logo_url") or f"{cls.CLINIC_LOGOS_BASE}/{slug}.png"
        site_url = clinic.get("resolved_website_url") or "https://health.valioz.com/"
        
        encoded_email = urllib.parse.quote(email)
        encoded_name = urllib.parse.quote(name)
        unsub_url = f"https://health.valioz.com/unsubscribe/?email={encoded_email}&clinic={encoded_name}"
        booking_url = cls.BOOKING_URL

        header_html = cls.header(name, logo_url, site_url)
        hero_html = cls.hero(name, city, angle, booking_url)
        metrics_html = cls.metrics_grid(city, angle)
        opps_html = cls.opportunities()
        demand_html = cls.demand_and_opportunity(name)
        diff_html = cls.valioz_difference()
        cta_html = cls.primary_cta(booking_url)
        footer_html = cls.reply_and_footer(name, unsub_url)

        return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>{name} | VALIOZ Health Growth Audit</title>
  <style type="text/css">
    body {{
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      background-color: #ffffff !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }}
    table {{
      border-collapse: collapse !important;
      mso-table-lspace: 0pt !important;
      mso-table-rspace: 0pt !important;
    }}
    img {{
      border: 0 !important;
      outline: none !important;
      text-decoration: none !important;
      display: block !important;
    }}
    a {{
      text-decoration: none;
    }}
    @media screen and (max-width: 620px) {{
      .email-shell {{
        width: 100% !important;
        max-width: 100% !important;
      }}
      .email-padding {{
        padding: 16px 14px !important;
      }}
      .col-stack {{
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        padding-bottom: 12px !important;
        box-sizing: border-box !important;
      }}
      .hero-img-col img {{
        margin: 12px auto 0 auto !important;
        max-width: 280px !important;
      }}
      .hide-mobile {{
        display: none !important;
      }}
    }}
  </style>
</head>
<body style="margin:0;padding:0;background:#ffffff;background-color:#ffffff;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">
    Prepared for {name}: your VALIOZ Health growth audit.
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;background-color:#ffffff;">
    <tr>
      <td align="center" class="email-padding" style="padding:24px 12px;background:#ffffff;background-color:#ffffff;">
        <table role="presentation" class="email-shell" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;background-color:#ffffff;text-align:left;">
          <tr>
            <td>
              {header_html}
              {hero_html}
              {metrics_html}
              {opps_html}
              {demand_html}
              {diff_html}
              {cta_html}
              {footer_html}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
