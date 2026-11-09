/**
 * Valioz Health — the five sequence steps, shared by every builder.
 * Keeping the copy here prevents the "empty body" class of bug where a
 * content block expects a tag the builder never supplies.
 */

const STEPS = [
  { key: '01-welcome', file: 'content-01-welcome', output: '01-welcome.html', label: 'Welcome', title: '01 - Welcome' },
  { key: '02-pas-awareness', file: 'content-02-pas-awareness', output: '02-pas-awareness.html', label: 'PAS awareness', title: '02 - PAS Awareness' },
  { key: '03-aida-conversion', file: 'content-03-aida-conversion', output: '03-aida-conversion.html', label: 'AIDA conversion', title: '03 - AIDA Conversion' },
  { key: '04-case-study', file: 'content-04-case-study', output: '04-case-study.html', label: 'Case study', title: '04 - Case Study' },
  { key: '05-urgency', file: 'content-05-urgency', output: '05-urgency.html', label: 'Urgency', title: '05 - Urgency' },
];

const STEP_MAP = Object.fromEntries(STEPS.map((step) => [step.key, step]));

function esc(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(name = '') {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function unsubscribeUrl(clinic) {
  const email = encodeURIComponent(clinic.clinic_email || '');
  const name = encodeURIComponent(clinic.clinic_brand_name || '');
  return `https://osv.nilesupplies.com/unsubscribe?email=${email}&clinic=${name}`;
}

const { offerBlock, ctaBlock } = require('./offer-content');
const { researchFor, researchCard } = require('./clinic-research');

function welcomeLead({ name, firstName, city, research }) {
  const opening = `Hi ${firstName}, we took a closer look at how patients discover dental care in <b>${city}</b>.`;
  if (research.websiteState === 'live') {
    return `${opening} ${name} already has a live web presence, so the opportunity is making sure that visibility turns into booked appointments.`;
  }
  if (research.websiteState === 'broken') {
    return `${opening} We couldn’t load a working website for ${name} when we checked, which can be a costly first impression for patients who are ready to book.`;
  }
  return research.reputationLine
    ? `${opening} ${name} has earned real local trust, and there may be an opportunity to turn that trust into more booked appointments.`
    : `${opening} We’d like to show you where patients may be slipping away — and what it would take to fix it.`;
}

function contentForStep(step, clinic, { contactFirstName = 'there' } = {}) {
  const rawName = clinic.clinic_brand_name || 'Your Practice';
  const name = esc(rawName);
  const firstName = esc(contactFirstName);
  const city = esc(clinic.city || 'your area');
  const research = researchFor(clinic);
  const searchTerm = esc(research.searchTerm);
  const common = {
    ctaLink: 'https://health.valioz.com/',
    ctaText: 'Book Your Free Growth Audit',
    unsubscribeUrl: unsubscribeUrl(clinic),
    firstName,
    city,
    offerBlock: offerBlock({ hasWebsite: research.websiteState === 'live' }),
  };

  let content;

  switch (step.key) {
    case '01-welcome':
      content = {
        ...common,
        eyebrowTag: 'A growth opportunity for your clinic',
        headline: `More patients are searching.<br><span style="color:#009F9F;">Will they find ${name}?</span>`,
        leadCopy: welcomeLead({ name, firstName, city, research }),
        researchCard: researchCard({
          reputationLine: esc(research.reputationLine),
          coverageLine: esc(research.coverageLine),
          siteLine: esc(research.siteLine),
        }),
        bodyCopy:
          'Most healthcare websites lose patients before the first click — slow load times, thin content, and no AI visibility ' +
          'mean your practice stays invisible exactly when someone needs care.<br><br>' +
          'You’re now on the Valioz Health list. Over the coming weeks we’ll share how independent dental practices fill their ' +
          'schedules with healthcare SEO, GEO (AI search), conversion-ready websites, and performance tracking — all HIPAA-conscious by design.',
        psCopy: `The searcher looking for ${name} is online right now. They’ll book whoever shows up first.`,
        ctaText: 'Book Your Free Growth Audit',
      };
      break;

    case '02-pas-awareness':
      content = {
        ...common,
        eyebrowTag: 'Week 1 · Problem',
        headline: 'Your website is losing patients<br><span style="color:#009F9F;">while you sleep</span>',
        leadCopy:
          `Hi ${firstName}, when someone in <b>${city}</b> searches for “${searchTerm},” the practices they can actually find get the call.`,
        bodyCopyPasProblem:
          'Most healthcare practices rank on page two — or not at all — for “dentist near me” and “dentist in your city” searches.',
        bodyCopyPasAgitation:
          'Every day you’re invisible, a competitor books the patient who would have chosen you. Empty chairs while you pay rent, staff, and equipment.',
        bodyCopyPasSolution:
          'Valioz Health audits your local SEO and builds a patient-acquisition system that gets you found — healthcare SEO, ' +
          'local pack placement, and a conversion-ready website built for booking.',
        psCopy: 'The searcher looking for your specialty is online right now. They’ll book whoever shows up first.',
      };
      break;

    case '03-aida-conversion':
      content = {
        ...common,
        eyebrowTag: 'Week 2 · Solution',
        headline: 'What a patient-winning website<br><span style="color:#009F9F;">actually looks like</span>',
        leadCopy: `Hi ${firstName}, your website is the first impression most patients will ever have of ${name}.`,
        bodyCopyAidaAttention: '88% of patients research online before booking. Your website is your front desk.',
        bodyCopyAidaInterest:
          'Valioz Health builds HIPAA-conscious, mobile-first websites that load under two seconds and guide visitors from ' +
          '“I have pain” to “I’m booked.”',
        bodyCopyAidaDesire:
          'Booking-form optimization, clear calls-to-action on every page, and patient-trust signals (reviews, credentials, ' +
          'before/after). Practices we work with see <strong>+130% more inquiries</strong>.',
        psCopy: 'A slow, outdated site doesn’t just lose clicks — it loses chairs. Let’s fix that this week.',
        ctaLink: 'https://health.valioz.com/contact/',
        ctaText: 'Schedule a Website Review',
      };
      break;

    case '04-case-study':
      content = {
        ...common,
        eyebrowTag: 'Week 3 · Case study',
        headline: 'How a dental practice added<br><span style="color:#009F9F;">40 bookings a month</span>',
        leadCopy:
          `Hi ${firstName}, here’s what happens when a practice stops guessing and builds a system that gets found.`,
        bodyCopyCaseProblem:
          `A three-provider dental practice was on page two for “family dentist ${city}.” Empty chairs, reactive marketing.`,
        bodyCopyCaseAgitation:
          'They were spending on print ads and directories with no tracking — no idea what actually worked.',
        bodyCopyCaseSolution:
          'Valioz Health rebuilt their website, ran local SEO, added call tracking, and launched performance marketing — ' +
          'all compliant, all measurable.',
        psCopy: 'Same market, same chairs — just a system that actually gets found and measured. Want the audit that starts it?',
        ctaLink: 'https://health.valioz.com/insights/',
        ctaText: 'Read the Full Case Study',
      };
      break;

    case '05-urgency':
      content = {
        ...common,
        eyebrowTag: 'Week 4 · Limited spots',
        headline: 'Last chance: a free growth audit<br><span style="color:#009F9F;">this month</span>',
        leadCopy: `Hi ${firstName}, the calendar is about to turn and your competitors are already in the local pack.`,
        bodyCopyUrgencyProblem: 'You’re still guessing where your patients come from.',
        bodyCopyUrgencyAgitation:
          'Every week you wait is another week your competitors capture the local pack and the AI answers patients read first.',
        bodyCopyUrgencySolution:
          'We’re running free growth audits this month — limited to five practices. We’ll review your local SEO, website, ' +
          'and AI visibility, and show you exactly where patients are slipping away.',
        psCopy: 'Spots are held by the first practices to book. Reply to this email and we’ll reserve yours.',
        ctaText: 'Claim Your Audit Spot',
      };
      break;

    default:
      throw new Error(`Unknown sequence step: ${step.key}`);
  }

  content.ctaBlock = ctaBlock({
    clinicName: name,
    ctaLink: content.ctaLink,
    ctaText: content.ctaText,
    psCopy: content.psCopy,
  });

  return content;
}

function subjectForStep(step, clinic, { contactFirstName = '' } = {}) {
  const name = clinic.clinic_brand_name || 'your practice';
  switch (step.key) {
    case '01-welcome':
      return `${contactFirstName ? `${contactFirstName}, your` : 'Your'} ${name} growth audit`;
    case '02-pas-awareness':
      return `Is ${name} invisible when patients search?`;
    case '03-aida-conversion':
      return `What a patient-winning website looks like`;
    case '04-case-study':
      return `How a dental practice added 40 bookings/month`;
    case '05-urgency':
      return `Last chance: free growth audit this month`;
    default:
      return `${name} — Valioz Health`;
  }
}

function clinicBrand(clinic) {
  const safeUrl = (value, fallback) => (/^https?:\/\//i.test(String(value || '')) ? value : fallback);
  return {
    name: esc(clinic.clinic_brand_name || 'Your Practice'),
    primary: clinic.primary_color || '#172C46',
    secondary: clinic.secondary_color || '#56667A',
    text: clinic.text_color || '#212121',
    accent: clinic.accent_color || '#00AFA5',
    logoUrl: safeUrl(clinic.clinic_logo_hosted_url, ''),
    siteUrl: safeUrl(clinic.resolved_website_url, 'https://health.valioz.com'),
  };
}

function contactNameFor(clinic) {
  const manager = (clinic.office_manager_name || '').trim();
  if (manager) return manager.split(/\s+/)[0];
  return 'there';
}

module.exports = {
  STEPS,
  STEP_MAP,
  contentForStep,
  subjectForStep,
  clinicBrand,
  contactNameFor,
  slugify,
  esc,
  unsubscribeUrl,
};
