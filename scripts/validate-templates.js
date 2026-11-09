#!/usr/bin/env node
/**
 * Valioz Health — Pre-Send QA
 *
 * Fails the build unless:
 *   1. Every enriched logo URL is a public HTTPS PNG, 200 OK, <=180x60, <=50 KB,
 *      and byte-identical to the local asset that will be committed.
 *   2. Every clinic produced exactly five HTML files.
 *   3. Each file contains exactly two images (Valioz left, clinic right), the
 *      "Prepared for" label, the real body copy, no unresolved tags, no
 *      flexbox/grid, and balanced table markup.
 *
 * Run: npm test
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parse } = require('csv-parse/sync');
const fetch = require('node-fetch');
const sharp = require('sharp');
const { STEP_MARKERS, htmlToText } = require('../lib/builder');
const { STEPS, slugify, esc, contentForStep } = require('../lib/sequence-content');
const { researchFor } = require('../lib/clinic-research');
const VALIOZ = require('../lib/valioz-brand');

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist', 'personalized');
const COMPILED_DIR = path.join(ROOT, 'compiled');
const ASSETS_DIR = path.join(ROOT, 'assets', 'clinic-logos');
const ENRICHED_CSV = path.join(ROOT, 'data', 'dental-clinics-enriched.csv');

const MAX_BYTES = 50 * 1024;
const MAX_WIDTH = 180;
const MAX_HEIGHT = 60;
const CONCURRENCY = 8;

let errors = 0;
let warnings = 0;

function fail(message) {
  console.error(`  ✖ ${message}`);
  errors += 1;
}

function warn(message) {
  console.log(`  ⚠ ${message}`);
  warnings += 1;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function isPng(buffer) {
  return (
    buffer.length > 8 &&
    buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  );
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  const run = async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function fetchImage(url) {
  const res = await fetch(url, {
    timeout: 20000,
    redirect: 'follow',
    headers: { 'user-agent': 'ValiozTemplateQA/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!type.startsWith('image/')) throw new Error(`content-type ${type || '(none)'}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_BYTES) throw new Error(`${buffer.length} bytes (>50 KB)`);
  return { buffer, type };
}

async function validateClinicLogo(row) {
  const name = row.clinic_brand_name;
  const slug = slugify(name);
  const url = row.clinic_logo_hosted_url;

  if (!url || !url.startsWith('https://')) {
    fail(`[${name}] logo URL is not public HTTPS: ${url || '(empty)'}`);
    return;
  }
  if (!url.endsWith(`/${slug}.png`)) {
    fail(`[${name}] logo URL does not match clinic slug "${slug}": ${url}`);
    return;
  }
  if (!['OK', 'FALLBACK'].includes(row.logo_verified_status)) {
    fail(`[${name}] invalid logo_verified_status "${row.logo_verified_status}"`);
  } else {
    const expected = ['WEBSITE_HEADER', 'CURATED'].includes(row.logo_source_tier)
      ? 'OK'
      : 'FALLBACK';
    if (!['WEBSITE_HEADER', 'CURATED', 'DSO_FALLBACK', 'MONOGRAM_FALLBACK', 'ICON_FALLBACK'].includes(row.logo_source_tier)) {
      fail(`[${name}] unknown logo_source_tier "${row.logo_source_tier}"`);
    } else if (row.logo_verified_status !== expected) {
      fail(
        `[${name}] status "${row.logo_verified_status}" does not match tier "${row.logo_source_tier}"`
      );
    }
  }

  try {
    const { buffer } = await fetchImage(url);
    if (!isPng(buffer)) throw new Error('response is not PNG bytes');
    const meta = await sharp(buffer).metadata();
    if (meta.format !== 'png') throw new Error(`decoded format ${meta.format}`);
    if (meta.width > MAX_WIDTH || meta.height > MAX_HEIGHT) {
      throw new Error(`${meta.width}x${meta.height} exceeds ${MAX_WIDTH}x${MAX_HEIGHT}`);
    }
    if (meta.width < 32 || meta.height < 12) {
      throw new Error(`${meta.width}x${meta.height} is too small to render`);
    }

    const localFile = path.join(ASSETS_DIR, `${slug}.png`);
    if (!fs.existsSync(localFile)) {
      throw new Error(`local asset missing: assets/clinic-logos/${slug}.png`);
    }
    const localHash = sha256(fs.readFileSync(localFile));
    if (localHash !== sha256(buffer)) {
      // GitHub's /main/ raw CDN can serve stale bytes for minutes after a
      // push; /refs/heads/main/ reads the branch head directly.
      const freshUrl = url.replace('/main/', '/refs/heads/main/');
      const fresh = freshUrl !== url ? (await fetchImage(freshUrl)).buffer : null;
      if (!fresh || sha256(fresh) !== localHash) {
        throw new Error('hosted image differs from local asset — commit and push assets');
      }
      warn(`[${name}] /main/ served stale bytes; /refs/heads/main/ matches the local asset`);
    }
  } catch (error) {
    fail(`[${name}] ${error.message} — ${url}`);
  }
}

function validateHtml(html, row, step, file) {
  const name = row.clinic_brand_name;
  const label = `[${name}] ${path.basename(file)}`;

  if (!html.startsWith('<!DOCTYPE html>')) fail(`${label} missing doctype`);
  if (!html.includes(VALIOZ.logoUrl)) fail(`${label} missing Valioz logo`);
  if (!html.includes(row.clinic_logo_hosted_url)) fail(`${label} missing clinic logo`);
  if (!html.includes(`Prepared for ${esc(name)}`)) fail(`${label} missing "Prepared for" label`);

  const images = (html.match(/<img\b/gi) || []).length;
  if (images !== 2) fail(`${label} expected 2 images, found ${images}`);
  if (!html.includes(`href="${VALIOZ.brandUrl}"`)) {
    fail(`${label} Valioz logo is not linked to valioz.com`);
  }
  if (!html.includes(`href="${VALIOZ.whatsappUrl}"`)) {
    fail(`${label} WhatsApp link is missing`);
  }
  if (!html.includes(`WhatsApp ${VALIOZ.whatsappNumber}`)) {
    fail(`${label} WhatsApp number is missing from the footer`);
  }
  if (html.includes('/growth-audit')) {
    fail(`${label} CTA points at the removed /growth-audit page`);
  }
  const { ctaLink } = contentForStep(step, row);
  if (!html.includes(`href="${ctaLink}"`)) {
    fail(`${label} CTA does not link to ${ctaLink}`);
  }
  for (const img of html.match(/<img\b[^>]*>/gi) || []) {
    if (!/height="48"/.test(img)) fail(`${label} header logo height attribute is not 48`);
    if (!/height:\s*48px/i.test(img)) fail(`${label} header logo CSS height is not 48px`);
    if (!/width:\s*auto/i.test(img)) fail(`${label} header logo CSS width is not auto`);
    if (!/display:\s*block/i.test(img)) fail(`${label} header logo is not display:block`);
    if (!/border:\s*0/i.test(img)) fail(`${label} header logo has a border`);
    if (!/max-width:\s*100%/i.test(img)) fail(`${label} header logo lacks max-width:100%`);
    if (!/alt="[^"]+"/i.test(img)) fail(`${label} header logo lacks alt text`);
  }

  if (/{{|}}/.test(html)) fail(`${label} contains unresolved template tags`);
  if (/display:\s*(flex|grid)/i.test(html)) fail(`${label} uses flexbox/grid`);
  if (/src=(""|'')|src=["']undefined["']/i.test(html)) fail(`${label} has an empty image src`);
  if (!/<table[^>]*role=["']presentation["']/i.test(html)) {
    fail(`${label} missing role="presentation" table`);
  }

  for (const tag of ['table', 'tr', 'td']) {
    const open = (html.match(new RegExp(`<${tag}\\b`, 'gi')) || []).length;
    const close = (html.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
    if (open !== close) fail(`${label} ${tag} tags unbalanced (${open} open / ${close} close)`);
  }

  const text = htmlToText(html);
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < 150) fail(`${label} body too thin (${words} words)`);
  if (!/HIPAA notice/i.test(text)) fail(`${label} missing HIPAA footer`);
  if (!/Unsubscribe/i.test(text)) fail(`${label} missing unsubscribe link`);
  if (!/<a\b[^>]*href="[^"]+"[^>]*>\s*Unsubscribe\s*<\/a>/i.test(html)) {
    fail(`${label} unsubscribe text is not a link`);
  }

  const marker = STEP_MARKERS[step.key];
  if (marker && !text.includes(marker)) fail(`${label} missing ${step.key} body copy`);
}

async function validateValiozLogo() {
  try {
    const { buffer, type } = await fetchImage(VALIOZ.logoUrl);
    if (!isPng(buffer)) throw new Error('response is not PNG bytes');
    const meta = await sharp(buffer).metadata();
    if (meta.format !== 'png') throw new Error(`decoded format ${meta.format}`);
    if (meta.height > 400 || meta.width > 1200) {
      throw new Error(`${meta.width}x${meta.height} is larger than expected for a header logo`);
    }
    console.log(`  ✓ Valioz logo ${meta.width}x${meta.height}, ${buffer.length} bytes (${type})`);
  } catch (error) {
    fail(`[Valioz Health] logo ${VALIOZ.logoUrl}: ${error.message}`);
  }
}

function validateCompiledMasters(expectedClinic) {
  if (!fs.existsSync(COMPILED_DIR)) {
    warn('compiled/ not found — run: node compile-templates.js');
    return;
  }
  const files = fs.readdirSync(COMPILED_DIR).filter((file) => file.endsWith('.html'));
  if (files.length !== STEPS.length) {
    fail(`compiled/ expected ${STEPS.length} master templates, found ${files.length}`);
  }
  for (const step of STEPS) {
    const file = path.join(COMPILED_DIR, step.output);
    if (!fs.existsSync(file)) {
      fail(`compiled/ missing ${step.output}`);
      continue;
    }
    const html = fs.readFileSync(file, 'utf8');
    if (!html.includes(VALIOZ.logoUrl)) fail(`compiled/${step.output} missing Valioz logo`);
    if (!html.includes(`href="${VALIOZ.whatsappUrl}"`)) {
      fail(`compiled/${step.output} WhatsApp link is missing`);
    }
    if (!html.includes(`WhatsApp ${VALIOZ.whatsappNumber}`)) {
      fail(`compiled/${step.output} WhatsApp number is missing from the footer`);
    }
    if (expectedClinic) {
      if (!html.includes(expectedClinic.clinic_logo_hosted_url)) {
        fail(`compiled/${step.output} missing clinic logo`);
      }
      if (!html.includes(`Prepared for ${esc(expectedClinic.clinic_brand_name)}`)) {
        fail(`compiled/${step.output} missing "Prepared for" label`);
      }
      const { ctaLink } = contentForStep(step, expectedClinic);
      if (!html.includes(`href="${ctaLink}"`)) {
        fail(`compiled/${step.output} CTA does not link to ${ctaLink}`);
      }
    }
    if (/{{|}}/.test(html)) fail(`compiled/${step.output} contains unresolved tags`);
    if ((html.match(/<img\b/gi) || []).length !== 2) {
      fail(`compiled/${step.output} must contain exactly 2 images`);
    }
    for (const tag of ['table', 'tr', 'td']) {
      const open = (html.match(new RegExp(`<${tag}\\b`, 'gi')) || []).length;
      const close = (html.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
      if (open !== close) {
        fail(`compiled/${step.output} ${tag} tags unbalanced (${open} open / ${close} close)`);
      }
    }
    const text = htmlToText(html);
    const marker = STEP_MARKERS[step.key];
    if (marker && !text.includes(marker)) {
      fail(`compiled/${step.output} missing ${step.key} body copy`);
    }
  }
}

async function validateCtaDestinations(rows) {
  const links = [
    ...[...new Set(STEPS.map((step) => contentForStep(step, rows[0]).ctaLink))].map(
      (url) => ['CTA', url]
    ),
    ['WhatsApp', VALIOZ.whatsappUrl],
  ];
  for (const [label, url] of links) {
    try {
      const res = await fetch(url, {
        timeout: 20000,
        redirect: 'follow',
        headers: { 'user-agent': 'ValiozTemplateQA/1.0' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.log(`  ✓ ${label} ${url} (${res.status})`);
    } catch (error) {
      fail(`[${label}] ${url}: ${error.message}`);
    }
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Valioz Health — Template Validation                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (!fs.existsSync(ENRICHED_CSV)) {
    console.error(`❌ Enriched CSV not found: ${ENRICHED_CSV}`);
    process.exit(1);
  }

  const rows = parse(fs.readFileSync(ENRICHED_CSV, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
  console.log(`📋 ${rows.length} enriched clinics\n`);

  const bySlug = new Map();
  for (const row of rows) {
    const slug = slugify(row.clinic_brand_name || '');
    if (!slug) {
      fail(`clinic has no usable slug: "${row.clinic_brand_name}"`);
      continue;
    }
    if (bySlug.has(slug)) {
      fail(`duplicate clinic slug "${slug}"`);
      continue;
    }
    bySlug.set(slug, row);
    if (!researchFor(row).matched) {
      fail(`[${row.clinic_brand_name}] missing data/clinic-research.csv row`);
    }
    if (!row.resolved_website_url) {
      warn(`[${row.clinic_brand_name}] resolved_website_url is empty`);
    }
  }

  console.log('🖼  Checking hosted clinic logos...');
  await mapLimit(rows, CONCURRENCY, validateClinicLogo);
  await validateValiozLogo();
  console.log('🔗 Checking CTA destinations...');
  await validateCtaDestinations(rows);

  console.log('\n📄 Checking compiled HTML...');
  if (!fs.existsSync(DIST_DIR)) {
    fail('dist/personalized/ not found — run: npm run build');
  } else {
    const actualDirs = fs
      .readdirSync(DIST_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    for (const slug of actualDirs) {
      if (!bySlug.has(slug)) fail(`unexpected clinic directory: dist/personalized/${slug}`);
    }

    for (const [slug, row] of bySlug) {
      const dir = path.join(DIST_DIR, slug);
      if (!fs.existsSync(dir)) {
        fail(`[${row.clinic_brand_name}] missing dist/personalized/${slug}/`);
        continue;
      }

      const files = fs.readdirSync(dir).filter((file) => file.endsWith('.html'));
      if (files.length !== STEPS.length) {
        fail(`[${row.clinic_brand_name}] expected ${STEPS.length} files, found ${files.length}`);
      }

      for (const step of STEPS) {
        const file = path.join(dir, step.output);
        if (!fs.existsSync(file)) {
          fail(`[${row.clinic_brand_name}] missing ${step.output}`);
          continue;
        }
        validateHtml(fs.readFileSync(file, 'utf8'), row, step, file);
      }
    }
  }

  validateCompiledMasters(bySlug.get('barrie-dental-arts'));

  console.log('\n═════════════════════════════════════════════════════════════');
  if (errors === 0) {
    console.log(
      warnings === 0
        ? '✅ ALL CHECKS PASSED — Templates are ready to send'
        : `✅ ALL CHECKS PASSED with ${warnings} warning(s)`
    );
  } else {
    console.log(`❌ ${errors} error(s), ${warnings} warning(s) — NOT ready to send`);
  }
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  process.exit(errors > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`\n❌ ${error.stack || error.message}`);
  process.exit(1);
});
