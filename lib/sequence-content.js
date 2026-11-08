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

function contentForStep(step, clinic, { contactFirstName = 'there' } = {}) {
  const rawName = clinic.clinic_brand_name || 'Your Practice';
  const name = esc(rawName);
  const greeting = `Hi ${esc(contactFirstName)},<br><br>`;
  const common = {
    ctaLink: 'https://health.valioz.com/',
    ctaText: 'Book Your Free Growth Audit',
    unsubscribeUrl: unsubscribeUrl(clinic),
  };

  switch (step.key) {
    case '01-welcome':
      return {
        ...common,
        eyebrowTag: 'Welcome to Valioz Health',
        headline: `Is your ${name} website losing patients?`,
        bodyCopy:
          greeting +
          'Most healthcare websites lose patients before the first click — slow load times, thin content, and no AI visibility mean your practice stays invisible exactly when someone needs care.<br><br>' +
          'You’re now on the Valioz Health list. Over the coming weeks we’ll share how independent dental, psychology, and medical practices fill their schedules with healthcare SEO, GEO (AI search), conversion-ready websites, and performance tracking — all HIPAA-conscious by design.',
        proof: 'Proof it works',
        statCopy: '+130% average increase in patient inquiries after launch',
        psCopy: `The searcher looking for ${name} is online right now. They’ll book whoever shows up first.`,
        ctaText: 'Book Your Free Growth Audit',
      };

    case '02-pas-awareness':
      return {
        ...common,
        eyebrowTag: 'Week 1 · Problem',
        headline: 'Your website is losing patients while you sleep',
        bodyCopyPasProblem:
          greeting +
          'Most healthcare practices rank on page two — or not at all — for “dentist near me” and “psychologist [city]” searches.',
        bodyCopyPasAgitation:
          'Every day you’re invisible, a competitor books the patient who would have chosen you. Empty chairs while you pay rent, staff, and equipment.',
        bodyCopyPasSolution:
          'Valioz Health audits your local SEO and builds a patient-acquisition system that gets you found — healthcare SEO, local pack placement, and a conversion-ready website built for booking.',
        proof: 'Our typical result',
        statCopy: 'Top 3 local pack placement within 90 days · +130% average increase in inquiries',
        psCopy: 'The searcher looking for your specialty is online right now. They’ll book whoever shows up first.',
      };

    case '03-aida-conversion':
      return {
        ...common,
        eyebrowTag: 'Week 2 · Solution',
        headline: 'What a patient-winning healthcare website actually looks like',
        bodyCopyAidaAttention:
          greeting + '88% of patients research online before booking. Your website is your front desk.',
        bodyCopyAidaInterest:
          'Valioz Health builds HIPAA-conscious, mobile-first websites that load under two seconds and guide visitors from “I have pain” to “I’m booked.”',
        bodyCopyAidaDesire:
          'Booking-form optimization, clear calls-to-action on every page, and patient-trust signals (reviews, credentials, before/after). Practices we work with see <strong>+130% more inquiries</strong>.',
        proof: 'The outcome',
        statCopy: 'Visitors book, not bounce',
        psCopy: 'A slow, outdated site doesn’t just lose clicks — it loses chairs. Let’s fix that this week.',
        ctaLink: 'https://health.valioz.com/contact/',
        ctaText: 'Schedule a Website Review',
      };

    case '04-case-study':
      return {
        ...common,
        eyebrowTag: 'Week 3 · Case study',
        headline: 'How a dental practice added 40 bookings/month',
        bodyCopyCaseProblem:
          greeting +
          'A three-provider dental practice was on page two for “family dentist [city].” Empty chairs, reactive marketing.',
        bodyCopyCaseAgitation:
          'They were spending on print ads and directories with no tracking — no idea what actually worked.',
        bodyCopyCaseSolution:
          'Valioz Health rebuilt their website, ran local SEO, added call tracking, and launched performance marketing — all compliant, all measurable.',
        proof: 'The result',
        statCopy: '40+ new patient bookings per month · PAC down 35% in 90 days',
        psCopy: 'Same market, same chairs — just a system that actually gets found and measured. Want the audit that starts it?',
        ctaLink: 'https://health.valioz.com/insights/',
        ctaText: 'Read the Full Case Study',
      };

    case '05-urgency':
      return {
        ...common,
        eyebrowTag: 'Week 4 · Limited spots',
        headline: 'Last chance: free growth audit this month',
        bodyCopyUrgencyProblem: greeting + 'You’re still guessing where your patients come from.',
        bodyCopyUrgencyAgitation:
          'Every week you wait is another week your competitors capture the local pack and the AI answers patients read first.',
        bodyCopyUrgencySolution:
          'We’re running free growth audits this month — limited to five practices. We’ll review your local SEO, website, and AI visibility, and show you exactly where patients are slipping away.',
        proof: 'Act before Friday',
        statCopy: 'Five audit spots. First come, first served.',
        psCopy: 'Spots are held by the first practices to book. Reply to this email and we’ll reserve yours.',
        ctaLink: 'https://health.valioz.com/',
        ctaText: 'Claim Your Audit Spot',
      };

    default:
      throw new Error(`Unknown sequence step: ${step.key}`);
  }
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
