/**
 * =============================================================================
 * Valioz Health — Build Templates (Dual-Brand HTML Compiler)
 * =============================================================================
 * Reads enriched clinic CSV + base templates and produces per-clinic HTML
 * files with both VALIOZ Health (wrapper) and clinic (content) branding.
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE_DIR = path.join(ROOT, 'email-sequence', 'templates');
const DATA_DIR = path.join(ROOT, 'data');
const DIST_DIR = path.join(ROOT, 'dist', 'personalized');
const ENRICHED_CSV = path.join(DATA_DIR, 'dental-clinics-enriched.csv');

const TemplateEngine = require('../lib/template-engine');

const engine = new TemplateEngine({ templateDir: TEMPLATE_DIR });

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

const TEMPLATE_MAP = {
  '01-welcome': 'content-01-welcome',
  '02-pas-awareness': 'content-02-pas-awareness',
  '03-aida-conversion': 'content-03-aida-conversion',
  '04-case-study': 'content-04-case-study',
  '05-urgency': 'content-05-urgency',
};

function buildForClinic(clinic) {
  const results = {};

  for (const [stepName, templateName] of Object.entries(TEMPLATE_MAP)) {
    const contentBlockHtml = engine.load(templateName);

    const content = {
      eyebrowTag: `Week ${stepName === '01-welcome' ? 0 : stepName === '02-pas-awareness' ? 1 : stepName === '03-aida-conversion' ? 2 : stepName === '04-case-study' ? 3 : 4} · ${
        stepName === '01-welcome' ? 'Welcome'
        : stepName === '02-pas-awareness' ? 'Problem'
        : stepName === '03-aida-conversion' ? 'Solution'
        : stepName === '04-case-study' ? 'Case study'
        : 'Limited spots'
      }`,
      headline: clinic.clinic_brand_name
        ? `Is your ${clinic.clinic_brand_name} website losing patients?`
        : 'Your website is losing patients while you sleep',
      bodyCopy: `Most healthcare practices rank on page two — or not at all — for "dentist near me" searches. Every day you're invisible, a competitor books the patient who would have chosen you.<br><br>Valioz Health audits your local SEO and builds a patient-acquisition system that gets you found — healthcare SEO, local pack placement, and a conversion-ready website built for booking.`,
      proof: 'Our typical result',
      statCopy: 'Top 3 local pack placement within 90 days · +130% average increase in inquiries',
      psCopy: `The searcher looking for ${clinic.clinic_brand_name || 'your specialty'} is online right now. They'll book whoever shows up first.`,
      ctaLink: 'https://health.valioz.com/growth-audit',
      ctaText: 'Book Your Free Growth Audit',
      unsubscribeUrl: `https://osv.nilesupplies.com/unsubscribe?email=${encodeURIComponent(clinic.clinic_email || '')}&clinic=${encodeURIComponent(clinic.clinic_brand_name || '')}`,
    };

    const renderedContent = engine.render(contentBlockHtml, {
      valioz: VALIOZ_BRAND,
      clinic: {
        name: clinic.clinic_brand_name || 'Your Practice',
        primary: clinic.primary_color || '#1B5E20',
        secondary: clinic.secondary_color || '#4CAF50',
        text: clinic.text_color || '#212121',
        accent: clinic.accent_color || '#FFB300',
        logoUrl: clinic.clinic_logo_hosted_url || '',
        siteUrl: clinic.resolved_website_url || 'https://health.valioz.com',
      },
      content,
    });

    const baseHtml = engine.load('base');
    let fullHtml = baseHtml.replace('{{CONTENT_BLOCK}}', renderedContent);
    fullHtml = engine.render(fullHtml, {
      valioz: VALIOZ_BRAND,
      clinic: {
        name: clinic.clinic_brand_name || 'Your Practice',
        primary: clinic.primary_color || '#1B5E20',
        secondary: clinic.secondary_color || '#4CAF50',
        text: clinic.text_color || '#212121',
        accent: clinic.accent_color || '#FFB300',
        logoUrl: clinic.clinic_logo_hosted_url || '',
        siteUrl: clinic.resolved_website_url || 'https://health.valioz.com',
      },
      content,
    });

    results[stepName] = fullHtml;
  }

  return results;
}

function main() {
  if (!fs.existsSync(ENRICHED_CSV)) {
    console.error(`❌ Enriched CSV not found: ${ENRICHED_CSV}`);
    console.log('Run: node scripts/enrich-clinic-logos.js first');
    process.exit(1);
  }

  const csvContent = fs.readFileSync(ENRICHED_CSV, 'utf8');
  const clinics = csv.parse(csvContent, { columns: true, skip_empty_lines: true });

  fs.mkdirSync(DIST_DIR, { recursive: true });

  let count = 0;
  for (const clinic of clinics) {
    const slug = clinic.clinic_brand_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const clinicDir = path.join(DIST_DIR, slug);
    fs.mkdirSync(clinicDir, { recursive: true });

    const results = buildForClinic(clinic);

    for (const [stepName, html] of Object.entries(results)) {
      fs.writeFileSync(path.join(clinicDir, `${stepName}.html`), html, 'utf8');
    }

    count++;
    console.log(`✓ Built ${clinic.clinic_brand_name} → ${clinicDir}/`);
  }

  console.log(`\n✅ Built personalized templates for ${count} clinics → ${DIST_DIR}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
