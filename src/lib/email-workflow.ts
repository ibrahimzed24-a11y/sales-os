/**
 * Valioz Health — Dual-Brand Email Workflow for Sales OS
 *
 * Architecture:
 *   • Wrapper (header/footer/button/footer) = Valioz Health brand — constant sender
 *   • Content body (logo/headline/colors) = Target clinic brand — personalized per recipient
 *
 * Integrates with existing Sales OS infra:
 *   • src/lib/campaign.ts — renderTemplate(), categoryFromFile(), subjectFromHtml()
 *   • src/app/api/email/send/route.ts — Resend-based send endpoint
 *
 * Katteb: wire runSequence() to a cron or manual trigger inside Sales OS.
 */

import { renderTemplate, subjectFromHtml, categoryFromFile, Vars } from './campaign';
import { CLINIC_BRANDS, ClinicBrand, resolveClinicBrand } from './clinic-brands';
import fs from 'fs';
import path from 'path';

const TEMPLATE_DIR = path.join(process.cwd(), 'src/lib/email-templates');

// ---------- Valioz sender brand (from VALIOZ_Health_Brand_Kit_V2 / BRAND_TOKENS.json) ----------
export const VALIOZ_BRAND = {
  name: 'Valioz Health',
  navy: '#172C46',
  navyDeep: '#0F1F33',
  turquoise: '#00AFA5',
  turquoiseDeep: '#008C88',
  mist: '#E8F6F3',
  canvas: '#FAF9F6',
  ink: '#172C46',
  muted: '#56667A',
  white: '#FFFFFF',
  coral: '#FB5F62',
  coralDeep: '#E05555',
  line: 'rgba(23, 44, 70, 0.12)',
  logoUrl: 'https://health.valioz.com/assets/VALIOZ_Health_Primary.png',
  logoWhiteUrl: 'https://health.valioz.com/assets/VALIOZ_Health_White.png',
  siteUrl: 'https://health.valioz.com',
  address: 'Valioz Health · Yonge St, Toronto, ON M5B 2K9, Canada',
  fromEmail: process.env.SENDER_EMAIL || 'sales@health.valioz.com',
} as const;

// ---------- 30-day plan (from health_valioz_copywriting.md Part 2) ----------
export interface EmailStep {
  day: number;
  dow: string;
  framework: string;
  template: string;
  subject: string;
  cta: string;
  ctaLink: string;
}

export const PLAN: EmailStep[] = [
  { day: 1,  dow: 'Mon', framework: 'PAS',  template: '02-pas-awareness', subject: 'Your website is losing patients while you sleep', cta: 'Book Your Free Growth Audit', ctaLink: '/growth-audit' },
  { day: 3,  dow: 'Wed', framework: 'PAS',  template: '02-pas-awareness', subject: 'The $3,000 patient you\'re not seeing', cta: 'See the Audit', ctaLink: '/growth-audit' },
  { day: 5,  dow: 'Fri', framework: 'PAS',  template: '02-pas-awareness', subject: 'AI is answering patient questions. Is it naming you?', cta: 'Claim your GEO readiness check', ctaLink: '/geo-readiness' },
  { day: 8,  dow: 'Mon', framework: 'AIDA', template: '03-aida-conversion', subject: 'What a patient-winning healthcare website actually looks like', cta: 'Schedule a Website Review', ctaLink: '/website-review' },
  { day: 10, dow: 'Wed', framework: 'AIDA', template: '03-aida-conversion', subject: 'SEO for healthcare isn\'t generic. Here\'s why.', cta: 'Get your healthcare SEO audit', ctaLink: '/seo-audit' },
  { day: 12, dow: 'Fri', framework: 'AIDA', template: '03-aida-conversion', subject: 'GEO: The new SEO your competitors haven\'t heard of yet', cta: 'Book your GEO readiness session', ctaLink: '/geo-readiness' },
  { day: 15, dow: 'Mon', framework: 'PAS',  template: '04-case-study', subject: 'How a dental practice added 40 bookings/month', cta: 'Read the full case study', ctaLink: '/case-studies' },
  { day: 17, dow: 'Wed', framework: 'PAS',  template: '04-case-study', subject: 'Psychologist practice: from invisible to top 3 local pack', cta: 'See how we did it', ctaLink: '/case-studies' },
  { day: 19, dow: 'Fri', framework: 'AIDA', template: '03-aida-conversion', subject: 'The tracking most practices ignore (and why it costs them)', cta: 'Book a performance tracking setup call', ctaLink: '/tracking-setup' },
  { day: 22, dow: 'Mon', framework: 'AIDA', template: '03-aida-conversion', subject: 'Your next 10 patients are searching right now', cta: 'Book your 15-minute Growth Audit this week', ctaLink: '/growth-audit' },
  { day: 24, dow: 'Wed', framework: 'PAS+Urgency', template: '05-urgency', subject: 'Last chance: free growth audit this month', cta: 'Claim Your Audit Spot', ctaLink: '/growth-audit' },
  { day: 26, dow: 'Fri', framework: 'AIDA', template: '03-aida-conversion', subject: 'The patient acquisition system, in one call', cta: 'Schedule your Growth Audit', ctaLink: '/growth-audit' },
  { day: 29, dow: 'Mon', framework: 'PAS',  template: '02-pas-awareness', subject: 'Are you booked out for next month?', cta: 'Book Your Growth Audit', ctaLink: '/growth-audit' },
];

// ---------- Template cache ----------
const templateCache = new Map<string, string>();

function loadTemplate(name: string): string {
  if (templateCache.has(name)) return templateCache.get(name)!;
  const file = path.join(TEMPLATE_DIR, `${name}.html`);
  if (!fs.existsSync(file)) throw new Error(`Template not found: ${file}`);
  const html = fs.readFileSync(file, 'utf8');
  templateCache.set(name, html);
  return html;
}

const baseHtml = loadTemplate('base');

const contentBlockMap: Record<string, string> = {
  '01-welcome': 'content-01-welcome',
  '02-pas-awareness': 'content-02-pas-awareness',
  '03-aida-conversion': 'content-03-aida-conversion',
  '04-case-study': 'content-04-case-study',
  '05-urgency': 'content-05-urgency',
};

function loadContentBlock(templateName: string): string {
  const blockName = contentBlockMap[templateName];
  if (!blockName) throw new Error(`No content block for template: ${templateName}`);
  return loadTemplate(blockName);
}

// ---------- Contact type ----------
export interface EmailContact {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  city?: string;
  specialty?: string;
  clinicId?: string;
  accountId?: string;
  status?: string;
}

// ---------- Render one email for one contact (dual-brand) ----------
export interface RenderResult {
  html: string;
  text: string;
  subject: string;
  category: string;
  clinicId: string;
  clinicName: string;
}

export function renderEmail(
  step: EmailStep,
  contact: EmailContact,
  unsubscribeUrl: string,
): RenderResult {
  const clinicId = contact.clinicId || contact.accountId || 'default';
  const clinicBrand = resolveClinicBrand(clinicId);

  // Load base wrapper + clinic-branded content block
  const contentBlockHtml = loadContentBlock(step.template);

  // Build template variables for Sales OS renderTemplate() ({{variable}} syntax)
  const vars: Vars = {
    // Valioz sender brand
    valioz_logo_url: VALIOZ_BRAND.logoUrl,
    valioz_site_url: VALIOZ_BRAND.siteUrl,
    valioz_address: VALIOZ_BRAND.address,
    valioz_navy: VALIOZ_BRAND.navy,
    valioz_coral: VALIOZ_BRAND.coral,
    valioz_mist: VALIOZ_BRAND.mist,
    valioz_canvas: VALIOZ_BRAND.canvas,
    valioz_white: VALIOZ_BRAND.white,
    valioz_muted: VALIOZ_BRAND.muted,
    valioz_line: VALIOZ_BRAND.line,
    // Clinic recipient brand
    clinic_name: clinicBrand.name,
    clinic_primary: clinicBrand.primary,
    clinic_secondary: clinicBrand.secondary,
    clinic_text: clinicBrand.text,
    clinic_accent: clinicBrand.accent,
    clinic_logo_url: clinicBrand.logoUrl,
    clinic_site_url: clinicBrand.siteUrl,
    // Contact personalization
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
    company: contact.company || '',
    city: contact.city || '',
    specialty: contact.specialty || '',
    email: contact.email,
    website: clinicBrand.siteUrl,
    // Content (step-specific)
    headline: step.subject,
    body_copy: bodyCopyForStep(step, clinicBrand.name),
    body_copy_pas_problem: pasCopy(step, 'problem'),
    body_copy_pas_agitation: pasCopy(step, 'agitation'),
    body_copy_pas_solution: pasCopy(step, 'solution'),
    body_copy_aida_attention: `88% of patients research online before booking. ${clinicBrand.name}'s website is your front desk.`,
    body_copy_aida_interest: 'Valioz Health builds HIPAA-conscious, mobile-first websites that load under two seconds and guide visitors from "I have pain" to "I\'m booked."',
    body_copy_aida_desire: 'Booking-form optimization, clear calls-to-action on every page, and patient-trust signals. Practices we work with see +130% more inquiries.',
    body_copy_case_problem: pasCopy(step, 'problem'),
    body_copy_case_agitation: pasCopy(step, 'agitation'),
    body_copy_case_solution: pasCopy(step, 'solution'),
    body_copy_urgency_problem: urgencyCopy(step, 'problem'),
    body_copy_urgency_agitation: urgencyCopy(step, 'agitation'),
    body_copy_urgency_solution: urgencyCopy(step, 'solution'),
    proof_label: step.framework === 'PAS' ? 'Our typical result' : 'The outcome',
    stat_copy: statCopyForStep(step),
    ps_copy: psCopyForStep(step),
    cta_link: `https://health.valioz.com${step.ctaLink}`,
    cta_text: step.cta,
    unsubscribe_link: unsubscribeUrl,
  };

  // Render content block first (clinic-branded body)
  const renderedContent = renderTemplate(contentBlockHtml, vars, true);

  // Wrap in Valioz base HTML
  let fullHtml = baseHtml.replace('{{content_block}}', renderedContent);

  // Render any remaining {{variable}} tags in the base wrapper
  fullHtml = renderTemplate(fullHtml, vars, true);

  const subject = subjectFromHtml(fullHtml) || step.subject;
  const category = categoryFromFile(step.template);

  return {
    html: fullHtml,
    text: '', // will be filled by caller using htmlToText from campaign.ts
    subject,
    category,
    clinicId,
    clinicName: clinicBrand.name,
  };
}

// ---------- Copy helpers (Katteb: plug in real copy from health_valioz_copywriting.md) ----------
function pasCopy(step: EmailStep, part: 'problem' | 'agitation' | 'solution'): string {
  const copy: Record<string, Record<string, string>> = {
    'Your website is losing patients while you sleep': {
      problem: 'Most healthcare practices rank on page two — or not at all — for "dentist near me" and "psychologist [city]" searches.',
      agitation: 'Every day you\'re invisible, a competitor books the patient who would have chosen you. Empty chairs while you pay rent, staff, and equipment.',
      solution: 'Valioz Health audits your local SEO and builds a patient-acquisition system that gets you found — healthcare SEO, local pack placement, and a conversion-ready website.',
    },
    'Last chance: free growth audit this month': {
      problem: 'You\'re still guessing where your patients come from.',
      agitation: 'Every week you wait is another week your competitors capture the local pack and the AI answers patients read first.',
      solution: 'We\'re running free growth audits this month — limited to five practices. We\'ll review your local SEO, website, and AI visibility.',
    },
  };
  return copy[step.subject]?.[part] || '';
}

function urgencyCopy(step: EmailStep, part: 'problem' | 'agitation' | 'solution'): string {
  const copy: Record<string, Record<string, string>> = {
    'Last chance: free growth audit this month': {
      problem: 'You\'re still guessing where your patients come from.',
      agitation: 'Every week you wait is another week your competitors capture the local pack and the AI answers patients read first.',
      solution: 'We\'re running free growth audits this month — limited to five practices.',
    },
  };
  return copy[step.subject]?.[part] || '';
}

function statCopyForStep(step: EmailStep): string {
  const copy: Record<string, string> = {
    'Your website is losing patients while you sleep': 'Top 3 local pack placement within 90 days',
    'Last chance: free growth audit this month': 'Five audit spots. First come, first served.',
  };
  return copy[step.subject] || '+130% average increase in patient inquiries';
}

function psCopyForStep(step: EmailStep): string {
  const copy: Record<string, string> = {
    'Your website is losing patients while you sleep': 'The searcher looking for your specialty is online right now. They\'ll book whoever shows up first.',
    'Last chance: free growth audit this month': 'Spots are held by the first practices to book. Reply to this email and we\'ll reserve yours.',
  };
  return copy[step.subject] || 'Reply to this email and we\'ll run a quick local visibility check on your practice before your audit.';
}

function bodyCopyForStep(step: EmailStep, clinicName: string): string {
  const copy: Record<string, string> = {
    'Your website is losing patients while you sleep':
      'Most healthcare practices rank on page two — or not at all — for "dentist near me" and "psychologist [city]" searches. Every day you\'re invisible, a competitor books the patient who would have chosen you. Valioz Health audits your local SEO and builds a patient-acquisition system that gets you found.',
    'Last chance: free growth audit this month':
      'You\'re still guessing where your patients come from. Every week you wait is another week your competitors capture the local pack and the AI answers patients read first. We\'re running free growth audits this month — limited to five practices.',
  };
  return copy[step.subject] ||
    `Valioz Health helps ${clinicName} get found and booked through SEO, GEO, conversion-ready websites, and performance tracking — all HIPAA-conscious.`;
}

// ---------- Build unsubscribe URL ----------
export function buildUnsubscribeUrl(contact: EmailContact, campaignId: string, stepDay: number): string {
  const emailId = `${campaignId}-d${stepDay}-c${contact.id}`;
  return `https://osv.nilesupplies.com/unsubscribe?email=${encodeURIComponent(contact.email)}&token=${emailId}`;
}

// ---------- Campaign runner ----------
export interface CampaignRunResult {
  queued: number;
  sent: number;
  failed: number;
  campaignId: string;
  dryRun?: boolean;
}

export async function runSequence({
  contacts,
  startFromDay = 1,
  dryRun = false,
  campaignId = `valioz-30day-${Date.now()}`,
  sendFn, // (to, subject, html, text) => Promise<void>
}: {
  contacts: EmailContact[];
  startFromDay?: number;
  dryRun?: boolean;
  campaignId?: string;
  sendFn?: (to: string, subject: string, html: string, text: string) => Promise<void>;
}): Promise<CampaignRunResult> {
  console.log(`[email-workflow] Starting Valioz 30-day dual-brand sequence (campaign: ${campaignId})`);

  const eligible = contacts.filter(c =>
    c.status !== 'unsubscribed' && c.status !== 'bounced' && c.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)
  );
  console.log(`[email-workflow] ${eligible.length} eligible contacts`);

  if (eligible.length === 0) return { queued: 0, sent: 0, failed: 0, campaignId };

  let queued = 0;
  let sent = 0;
  let failed = 0;

  for (const step of PLAN) {
    if (step.day < startFromDay) continue;
    console.log(`[email-workflow] Day ${step.day} (${step.dow}) — ${step.subject} (${step.framework})`);

    for (const contact of eligible) {
      const unsubscribeUrl = buildUnsubscribeUrl(contact, campaignId, step.day);
      const { html, subject, text } = renderEmail(step, contact, unsubscribeUrl);
      queued++;

      if (dryRun) continue;

      try {
        if (sendFn) {
          await sendFn(contact.email, subject, html, text);
        } else {
          // Fallback: POST to Sales OS email send API
          await fetch(`${VALIOZ_BRAND.siteUrl}/api/email/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: contact.email, subject, html, text }),
          });
        }
        sent++;
      } catch (err) {
        failed++;
        console.error(`[email-workflow] Failed to send to ${contact.email}:`, err);
      }
    }
  }

  console.log(`[email-workflow] Queued: ${queued}, Sent: ${sent}, Failed: ${failed}`);
  return { queued, sent, failed, campaignId, dryRun };
}
