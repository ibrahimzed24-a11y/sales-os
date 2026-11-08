#!/usr/bin/env node
/**
 * Hostinger handoff for the dual-brand sequence.
 *
 *   node scripts/sync-hostinger.js --sync-templates
 *   node scripts/sync-hostinger.js --compose-lead "Barrie Dental Arts" \
 *     --to ibrahim.zed24@gmail.com --name Ibrahim
 *
 * --sync-templates stages the five titled masters plus the sender signature in
 * dist/hostinger/. When HOSTINGER_REACH_TOKEN and HOSTINGER_REACH_PROFILE are
 * set it also creates any missing templates in Hostinger Reach. The Reach API
 * cannot update an existing template, so existing titles are left untouched.
 *
 * --compose-lead writes a ready-to-import .eml plus .html/.txt previews in
 * dist/hostinger/outbox/. Importing the .eml into Hostinger keeps both remote
 * logos intact; nothing is sent by this script.
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { buildClinic, htmlToText } = require('../lib/builder');
const { STEPS, slugify, subjectForStep, contactNameFor } = require('../lib/sequence-content');
const VALIOZ = require('../lib/valioz-brand');

const ROOT = path.resolve(__dirname, '..');
const ENRICHED_CSV = path.join(ROOT, 'data', 'dental-clinics-enriched.csv');
const OUT_DIR = path.join(ROOT, 'dist', 'hostinger');
const TEMPLATE_DIR = path.join(OUT_DIR, 'templates');
const OUTBOX_DIR = path.join(OUT_DIR, 'outbox');
const STAGING_DIR = path.join(OUT_DIR, 'staging');

const FROM_EMAIL = process.env.SENDER_EMAIL || 'sales@health.valioz.com';
const SIGNATURE_NAME = process.env.HOSTINGER_SIGNATURE_NAME || 'Valioz Health Team';

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};

function usage() {
  console.log(`Usage:
  node scripts/sync-hostinger.js --sync-templates [--clinic "Barrie Dental Arts"]
  node scripts/sync-hostinger.js --compose-lead "<clinic>" --to "<email>" [--name "<first name>"] [--step 01-welcome]

Outputs go to dist/hostinger/. Nothing is sent automatically.`);
}

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function loadClinics() {
  if (!fs.existsSync(ENRICHED_CSV)) fail(`Enriched CSV not found: ${ENRICHED_CSV}\nRun: npm run enrich`);
  return parse(fs.readFileSync(ENRICHED_CSV, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
}

function normalizeName(name) {
  return slugify(name || '').replace(/-/g, '');
}

function findClinic(clinics, query) {
  if (!query) fail('A clinic name is required.');
  const wanted = normalizeName(query);
  const exact = clinics.filter((row) => normalizeName(row.clinic_brand_name) === wanted);
  if (exact.length === 1) return exact[0];

  const partial = clinics.filter((row) => normalizeName(row.clinic_brand_name).includes(wanted));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) {
    fail(`"${query}" matches ${partial.length} clinics:\n  ${partial
      .map((row) => row.clinic_brand_name)
      .join('\n  ')}`);
  }
  fail(`No enriched clinic matches "${query}".`);
}

function buildFor(clinic, steps, contactFirstName) {
  const slug = slugify(clinic.clinic_brand_name);
  fs.rmSync(path.join(STAGING_DIR, slug), { recursive: true, force: true });
  return buildClinic(clinic, { outDir: STAGING_DIR, contactFirstName, steps });
}

function base64Lines(value) {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/(.{76})/g, '$1\r\n');
}

function encodeHeader(value) {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function signatureHtml(name = SIGNATURE_NAME) {
  const safeName = name.replace(/[<>&]/g, '');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:${VALIOZ.ink};">
  <tr>
    <td valign="middle" style="padding:0 16px 0 0;border-right:2px solid ${VALIOZ.turquoise};">
      <a href="${VALIOZ.siteUrl}" target="_blank" style="text-decoration:none;">
        <img src="${VALIOZ.logoUrl}" alt="Valioz Health" height="36" style="height:36px;width:auto;display:block;border:0;">
      </a>
    </td>
    <td valign="middle" style="padding:0 0 0 16px;">
      <strong style="color:${VALIOZ.navy};">${safeName}</strong><br>
      <span style="color:${VALIOZ.muted};">Healthcare growth systems · SEO · GEO · Websites</span><br>
      <a href="mailto:${FROM_EMAIL}" style="color:${VALIOZ.turquoiseDeep};text-decoration:none;">${FROM_EMAIL}</a>
      <span style="color:${VALIOZ.muted};"> · </span>
      <a href="${VALIOZ.siteUrl}" style="color:${VALIOZ.turquoiseDeep};text-decoration:none;">health.valioz.com</a><br>
      <span style="color:${VALIOZ.muted};">${VALIOZ.address}</span>
    </td>
  </tr>
</table>`;
}

function signatureText(name = SIGNATURE_NAME) {
  return [
    name,
    'Healthcare growth systems · SEO · GEO · Websites',
    FROM_EMAIL,
    VALIOZ.siteUrl,
    VALIOZ.address,
  ].join('\n');
}

function writeSignature() {
  fs.writeFileSync(path.join(OUT_DIR, 'signature.html'), signatureHtml(), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'signature.txt'), signatureText(), 'utf8');
}

async function syncTemplates() {
  const clinics = loadClinics();
  const clinic = findClinic(clinics, valueOf('--clinic') || 'Barrie Dental Arts');
  const { files } = buildFor(clinic, STEPS, contactNameFor(clinic));

  fs.rmSync(TEMPLATE_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const templates = files.map(({ step }, index) => {
    const title = step.title || `${String(index + 1).padStart(2, '0')} - ${step.label}`;
    const target = path.join(TEMPLATE_DIR, `${title}.html`);
    fs.copyFileSync(path.join(STAGING_DIR, slugify(clinic.clinic_brand_name), step.output), target);
    return {
      title,
      step: step.key,
      subject: subjectForStep(step, clinic),
      file: path.relative(ROOT, target),
      bytes: fs.statSync(target).size,
    };
  });

  writeSignature();

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceClinic: clinic.clinic_brand_name,
    from: FROM_EMAIL,
    templates,
    signature: {
      html: path.relative(ROOT, path.join(OUT_DIR, 'signature.html')),
      text: path.relative(ROOT, path.join(OUT_DIR, 'signature.txt')),
    },
  };
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`✓ Staged ${templates.length} master templates for ${clinic.clinic_brand_name}`);
  for (const template of templates) console.log(`  ${template.title} → ${template.file} (${template.bytes} B)`);
  console.log(`✓ Signature → ${path.relative(ROOT, path.join(OUT_DIR, 'signature.html'))}`);

  const token = process.env.HOSTINGER_REACH_TOKEN;
  const profile = process.env.HOSTINGER_REACH_PROFILE;
  if (!token || !profile) {
    console.log('\nHostinger Reach not configured; files are ready to paste into');
    console.log('Webmail → Settings → Templates and → Signature.');
    console.log('Set HOSTINGER_REACH_TOKEN + HOSTINGER_REACH_PROFILE to create missing Reach templates.');
    return;
  }

  const base = `https://developers.hostinger.com/api/reach/v1/profiles/${encodeURIComponent(profile)}`;
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  const listRes = await fetch(`${base}/templates`, { headers });
  if (!listRes.ok) fail(`Reach list failed: HTTP ${listRes.status} ${await listRes.text()}`);
  const existing = new Set((await listRes.json()).map((item) => item.title));

  for (const template of templates) {
    if (existing.has(template.title)) {
      console.log(`  ⚠ Reach already has "${template.title}" — API cannot update it, skipped`);
      continue;
    }
    const html = fs.readFileSync(path.join(ROOT, template.file), 'utf8');
    const res = await fetch(`${base}/templates`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: template.title, template_content: html }),
    });
    if (!res.ok) fail(`Reach create "${template.title}" failed: HTTP ${res.status} ${await res.text()}`);
    console.log(`  ✓ Reach created "${template.title}"`);
  }
}

function buildEml({ to, subject, html, text }) {
  const boundary = `valioz-${Date.now().toString(36)}`;
  return [
    `From: Valioz Health <${FROM_EMAIL}>`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(html),
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

async function composeLead() {
  const query = valueOf('--compose-lead');
  const to = valueOf('--to');
  if (!query) fail('--compose-lead needs a clinic name.');
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) fail('--to needs a valid email address.');

  const stepKey = valueOf('--step') || '01-welcome';
  const step = STEPS.find((candidate) => candidate.key === stepKey);
  if (!step) fail(`Unknown step "${stepKey}". Use one of: ${STEPS.map((s) => s.key).join(', ')}`);

  const clinics = loadClinics();
  const clinic = findClinic(clinics, query);
  const firstName = valueOf('--name') || contactNameFor(clinic);
  const { files } = buildFor(clinic, [step], firstName);
  const html = files[0].html;
  const text = htmlToText(html);
  const subject = subjectForStep(step, clinic, {
    contactFirstName: firstName === 'there' ? '' : firstName,
  });

  fs.mkdirSync(OUTBOX_DIR, { recursive: true });
  const baseName = `${slugify(clinic.clinic_brand_name)}-${step.key}`;
  const emlFile = path.join(OUTBOX_DIR, `${baseName}.eml`);
  const htmlFile = path.join(OUTBOX_DIR, `${baseName}.html`);
  const textFile = path.join(OUTBOX_DIR, `${baseName}.txt`);

  fs.writeFileSync(emlFile, buildEml({ to, subject, html, text }), 'utf8');
  fs.writeFileSync(htmlFile, html, 'utf8');
  fs.writeFileSync(textFile, text, 'utf8');

  console.log(`✓ Draft for ${clinic.clinic_brand_name}`);
  console.log(`  To: ${to}`);
  console.log(`  Subject: ${subject}`);
  console.log(`  Import: ${path.relative(ROOT, emlFile)}`);
  console.log(`  Preview: ${path.relative(ROOT, htmlFile)}`);
  console.log('\nOpen the .eml in Hostinger (or drag it into the composer), verify both logos,');
  console.log('then send. The Sent copy should show naturalWidth > 0 for both images.');
}

async function main() {
  if (has('--sync-templates') === has('--compose-lead')) {
    usage();
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (has('--sync-templates')) await syncTemplates();
  else await composeLead();
}

main().catch((error) => {
  console.error(`❌ ${error.stack || error.message}`);
  process.exit(1);
});
