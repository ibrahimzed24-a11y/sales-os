/**
 * Compile all 5 Valioz Health email templates with dual-brand rendering.
 * Outputs standalone HTML files with both Valioz Health (wrapper) and target clinic (content) branding.
 */

const fs = require('fs');
const path = require('path');
const TemplateEngine = require('./lib/template-engine');

const TEMPLATE_DIR = path.join(__dirname, 'email-sequence', 'templates');
const OUTPUT_DIR = path.join(__dirname, 'compiled');

const engine = new TemplateEngine({ templateDir: TEMPLATE_DIR });

// Valioz Health brand (sender wrapper)
const VALIOZ_BRAND = {
  logoUrl: 'https://health.valioz.com/assets/VALIOZ_Health_Primary.png',
  siteUrl: 'https://health.valioz.com',
  address: 'Valioz Health · Yonge St, Toronto, ON M5B 2K9, Canada',
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
};

// Target clinic: Downtown Family Dental (from clinic-brands.js)
const CLINIC_BRAND = {
  name: 'Downtown Family Dental',
  primary: '#1B5E20',
  secondary: '#4CAF50',
  text: '#212121',
  accent: '#FFB300',
  logoUrl: 'https://osv.nilesupplies.com/assets/clinics/downtown-dental-logo.png',
  siteUrl: 'https://downtowndental.example.com',
};

// Template configurations: content block name (content-XX.html) -> output name
const TEMPLATES = [
  {
    name: '01-welcome',
    template: 'content-01-welcome',
    content: {
      eyebrowTag: 'Welcome to Valioz Health',
      headline: 'Your patients are searching. Are they finding you?',
      bodyCopy: 'Most healthcare websites lose patients before the first click — slow load times, thin content, and no AI visibility mean your practice stays invisible exactly when someone needs care.<br><br>You\'re now on the Valioz Health list. Over the coming weeks we\'ll share how independent dental, psychology, and medical practices fill their schedules with healthcare SEO, GEO (AI search), conversion-ready websites, and performance tracking — all HIPAA-conscious by design.',
      proof: 'Proof it works',
      statCopy: '+130% average increase in patient inquiries after launch',
      psCopy: 'Reply to this email and tell us your specialty and city — we\'ll run a quick local visibility check on your practice before your audit.',
      ctaLink: 'https://health.valioz.com/growth-audit',
      ctaText: 'Book Your Free Growth Audit',
      unsubscribeUrl: 'https://osv.nilesupplies.com/unsubscribe?email=example@example.com',
    },
  },
  {
    name: '02-pas-awareness',
    template: 'content-02-pas-awareness',
    content: {
      eyebrowTag: 'Week 1 · Problem',
      headline: 'Your website is losing patients while you sleep',
      bodyCopy: 'Most healthcare practices rank on page two — or not at all — for "dentist near me" and "psychologist [city]" searches.<br><br>Every day you\'re invisible, a competitor books the patient who would have chosen you. Empty chairs while you pay rent, staff, and equipment.<br><br>Valioz Health audits your local SEO and builds a patient-acquisition system that gets you found — healthcare SEO, local pack placement, and a conversion-ready website built for booking.',
      proof: 'Our typical result',
      statCopy: 'Top 3 local pack placement within 90 days',
      psCopy: 'The searcher looking for your specialty is online right now. They\'ll book whoever shows up first.',
      ctaLink: 'https://health.valioz.com/growth-audit',
      ctaText: 'Book Your Free Growth Audit',
      unsubscribeUrl: 'https://osv.nilesupplies.com/unsubscribe?email=example@example.com',
    },
  },
  {
    name: '03-aida-conversion',
    template: 'content-03-aida-conversion',
    content: {
      eyebrowTag: 'Week 2 · Solution',
      headline: 'What a patient-winning healthcare website actually looks like',
      bodyCopy: '88% of patients research online before booking. Your website is your front desk.<br><br>Valioz Health builds HIPAA-conscious, mobile-first websites that load under two seconds and guide visitors from "I have pain" to "I\'m booked."<br><br>Booking-form optimization, clear calls-to-action on every page, and patient-trust signals (reviews, credentials, before/after). Practices we work with see <strong>+130% more inquiries</strong>.',
      proof: 'The outcome',
      statCopy: 'Visitors book, not bounce',
      psCopy: 'A slow, outdated site doesn\'t just lose clicks — it loses chairs. Let\'s fix that this week.',
      ctaLink: 'https://health.valioz.com/website-review',
      ctaText: 'Schedule a Website Review',
      unsubscribeUrl: 'https://osv.nilesupplies.com/unsubscribe?email=example@example.com',
    },
  },
  {
    name: '04-case-study',
    template: 'content-04-case-study',
    content: {
      eyebrowTag: 'Week 3 · Case study',
      headline: 'How a dental practice added 40 bookings/month',
      bodyCopy: 'A three-provider dental practice was on page two for "family dentist [city]." Empty chairs, reactive marketing.<br><br>They were spending on print ads and directories with no tracking — no idea what actually worked.<br><br>Valioz Health rebuilt their website, ran local SEO, added call tracking, and launched performance marketing — all compliant, all measurable.',
      proof: 'The result',
      statCopy: '40+ new patient bookings per month · PAC down 35% in 90 days',
      psCopy: 'Same market, same chairs — just a system that actually gets found and measured. Want the audit that starts it?',
      ctaLink: 'https://health.valioz.com/case-studies',
      ctaText: 'Read the Full Case Study',
      unsubscribeUrl: 'https://osv.nilesupplies.com/unsubscribe?email=example@example.com',
    },
  },
  {
    name: '05-urgency',
    template: 'content-05-urgency',
    content: {
      eyebrowTag: 'Week 4 · Limited spots',
      headline: 'Last chance: free growth audit this month',
      bodyCopy: 'You\'re still guessing where your patients come from.<br><br>Every week you wait is another week your competitors capture the local pack and the AI answers patients read first.<br><br>We\'re running free growth audits this month — limited to five practices. We\'ll review your local SEO, website, and AI visibility, and show you exactly where patients are slipping away.',
      proof: 'Act before Friday',
      statCopy: 'Five audit spots. First come, first served.',
      psCopy: 'Spots are held by the first practices to book. Reply to this email and we\'ll reserve yours.',
      ctaLink: 'https://health.valioz.com/growth-audit',
      ctaText: 'Claim Your Audit Spot',
      unsubscribeUrl: 'https://osv.nilesupplies.com/unsubscribe?email=example@example.com',
    },
  },
];

// Ensure output directory exists
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

let compiledCount = 0;

for (const tmpl of TEMPLATES) {
  // Load the clinic-branded content block
  const contentBlockHtml = engine.load(tmpl.template);

  // Render content block with dual-brand (V_* for wrapper, C_* for content)
  const renderedContent = engine.render(contentBlockHtml, {
    valioz: VALIOZ_BRAND,
    clinic: CLINIC_BRAND,
    content: tmpl.content,
  });

  // Load the base wrapper
  const baseHtml = engine.load('base');

  // Wrap content block inside base wrapper - replace {{CONTENT_BLOCK}} placeholder
  let fullHtml = baseHtml.replace('{{CONTENT_BLOCK}}', renderedContent);

  // Also render any remaining {{V_*}} tags in the base wrapper (e.g., footer links)
  fullHtml = engine.render(fullHtml, {
    valioz: VALIOZ_BRAND,
    clinic: CLINIC_BRAND,
    content: tmpl.content,
  });

  // Write compiled file
  const outputPath = path.join(OUTPUT_DIR, `${tmpl.name}.html`);
  fs.writeFileSync(outputPath, fullHtml, 'utf8');

  console.log(`✓ Compiled: ${tmpl.name}.html (${fullHtml.length} bytes)`);
  compiledCount++;
}

console.log(`\n✅ Compiled ${compiledCount} templates to ${OUTPUT_DIR}/`);
