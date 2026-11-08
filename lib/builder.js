/**
 * Shared clinic-template builder.
 *
 * Every caller (batch build, legacy compile, Hostinger sync) goes through
 * this one function so the same assertions guard every artifact.
 */

const fs = require('fs');
const path = require('path');
const TemplateEngine = require('./template-engine');
const { STEPS, contentForStep, clinicBrand, contactNameFor, slugify, esc } = require('./sequence-content');

const TEMPLATE_DIR = path.join(__dirname, '..', 'email-sequence', 'templates');
const VALIOZ = require('./valioz-brand');

const STEP_MARKERS = {
  '01-welcome': 'Most healthcare websites lose patients',
  '02-pas-awareness': 'Every day you’re invisible',
  '03-aida-conversion': '88% of patients research online',
  '04-case-study': 'three-provider dental practice',
  '05-urgency': 'limited to five practices',
};

function htmlToText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function validateHtml(html, { clinic, step }) {
  const errors = [];
  const text = htmlToText(html);
  const words = text.split(/\s+/).filter(Boolean).length;

  if (!html.includes(VALIOZ.logoUrl)) errors.push('missing Valioz logo URL');
  if (!clinic.clinic_logo_hosted_url) errors.push('clinic logo URL missing');
  else if (!html.includes(clinic.clinic_logo_hosted_url)) errors.push('clinic logo URL not embedded');
  if (!html.includes(`Prepared for ${esc(clinic.clinic_brand_name)}`)) {
    errors.push('missing "Prepared for" label');
  }

  const images = (html.match(/<img\b/gi) || []).length;
  if (images !== 2) errors.push(`expected 2 images, found ${images}`);
  if (!html.includes(`href="${VALIOZ.brandUrl}"`)) {
    errors.push('Valioz logo is not linked to valioz.com');
  }
  for (const img of html.match(/<img\b[^>]*>/gi) || []) {
    if (!/height="48"/.test(img)) errors.push('header logo height attribute is not 48');
    if (!/height:\s*48px/i.test(img)) errors.push('header logo CSS height is not 48px');
    if (!/width:\s*auto/i.test(img)) errors.push('header logo CSS width is not auto');
    if (!/display:\s*block/i.test(img)) errors.push('header logo is not display:block');
    if (!/border:\s*0/i.test(img)) errors.push('header logo has a border');
    if (!/max-width:\s*100%/i.test(img)) errors.push('header logo lacks max-width:100%');
    if (!/alt="[^"]+"/i.test(img)) errors.push('header logo lacks alt text');
  }

  if (/\{\{|\}\}/.test(html)) errors.push('unresolved template tag');
  if (/display:\s*(flex|grid)/i.test(html)) errors.push('flexbox/grid is not email-safe');
  if (!/<table[^>]*role=["']presentation["']/i.test(html)) errors.push('missing role="presentation" table');
  if (/<img[^>]+src=["']{2}/i.test(html) || /src=["']undefined["']/i.test(html)) errors.push('empty image src');
  if (words < 150) errors.push(`body too thin (${words} words)`);
  if (!/HIPAA notice/i.test(text)) errors.push('missing HIPAA footer');
  if (!/Unsubscribe/i.test(text)) errors.push('missing unsubscribe link');
  if (!/<a\b[^>]*href="[^"]+"[^>]*>\s*Unsubscribe\s*<\/a>/i.test(html)) {
    errors.push('unsubscribe text is not a link');
  }

  const marker = STEP_MARKERS[step.key];
  if (marker && !text.includes(marker)) errors.push(`missing ${step.key} body copy`);

  if (errors.length) {
    throw new Error(`${clinic.clinic_brand_name} / ${step.key}: ${errors.join('; ')}`);
  }
  return { words };
}

function buildClinic(clinic, { outDir, contactFirstName, steps = STEPS, flat = false } = {}) {
  if (!clinic || !clinic.clinic_brand_name) throw new Error('clinic_brand_name is required');
  if (!clinic.clinic_logo_hosted_url) {
    throw new Error(`${clinic.clinic_brand_name}: clinic_logo_hosted_url is required`);
  }
  if (!/^https:\/\//i.test(clinic.clinic_logo_hosted_url)) {
    throw new Error(`${clinic.clinic_brand_name}: clinic logo must be a public HTTPS URL`);
  }

  const engine = new TemplateEngine({ templateDir: TEMPLATE_DIR });
  const brand = clinicBrand(clinic);
  const greetingName = contactFirstName || contactNameFor(clinic);
  const slug = slugify(clinic.clinic_brand_name);
  const baseDir = outDir || path.join(__dirname, '..', 'dist', 'personalized');
  const clinicDir = flat ? baseDir : path.join(baseDir, slug);
  fs.mkdirSync(clinicDir, { recursive: true });

  const files = [];
  for (const step of steps) {
    const content = contentForStep(step, clinic, { contactFirstName: greetingName });
    const block = engine.render(engine.load(step.file), {
      valioz: VALIOZ,
      clinic: brand,
      content,
      strict: true,
    });
    const base = engine.load('base').split('{{CONTENT_BLOCK}}').join(block);
    const html = engine.render(base, {
      valioz: VALIOZ,
      clinic: brand,
      content,
      strict: true,
    });

    validateHtml(html, { clinic, step });
    const file = path.join(clinicDir, step.output);
    fs.writeFileSync(file, html, 'utf8');
    files.push({ step, file, html });
  }

  return { slug, dir: clinicDir, files, brand };
}

module.exports = { buildClinic, validateHtml, htmlToText, STEP_MARKERS };
