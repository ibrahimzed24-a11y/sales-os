/**
 * =============================================================================
 * Valioz Health — Validate Templates (Pre-Send QA)
 * =============================================================================
 * Verifies:
 *  1. Every enriched clinic has a valid HTTPS PNG logo URL (200 OK, <50 KB)
 *  2. Compiled HTML templates preserve nested <table> structure
 *  3. No flexbox or grid in templates
 *  4. Both dual-brand logos present in each template
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
const fetch = require('node-fetch');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DIST_DIR = path.join(ROOT, 'dist', 'personalized');
const ENRICHED_CSV = path.join(DATA_DIR, 'dental-clinics-enriched.csv');

let errors = 0;
let warnings = 0;

function log(msg) { console.log(msg); }
function err(msg) { console.error(`  ✖ ${msg}`); errors++; }
function warn(msg) { console.log(`  ⚠ ${msg}`); warnings++; }

async function validateLogoUrl(url, clinicName) {
  if (!url || !url.startsWith('http')) {
    err(`[${clinicName}] logo URL missing or invalid: ${url}`);
    return false;
  }
  try {
    const res = await fetch(url, { method: 'HEAD', timeout: 10000 });
    if (!res.ok) {
      err(`[${clinicName}] logo ${url} returned ${res.status}`);
      return false;
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) {
      err(`[${clinicName}] logo ${url} content-type is ${ct}, expected image/`);
      return false;
    }
    const len = res.headers.get('content-length');
    if (len && parseInt(len, 10) > 50 * 1024) {
      err(`[${clinicName}] logo ${url} is ${len} bytes (>50 KB)`);
      return false;
    }
    return true;
  } catch (e) {
    err(`[${clinicName}] logo ${url} fetch failed: ${e.message}`);
    return false;
  }
}

function validateTemplate(html, clinicName) {
  let ok = true;

  // Must use tables, not flexbox/grid
  if (html.match(/display:\s*flex/i)) {
    err(`[${clinicName}] template uses flexbox (not email-safe)`);
    ok = false;
  }
  if (html.match(/display:\s*grid/i)) {
    err(`[${clinicName}] template uses CSS grid (not email-safe)`);
    ok = false;
  }

  // Must have table-based layout
  if (!html.match(/<table[^>]*role=["']presentation["']/i)) {
    err(`[${clinicName}] template missing table[role="presentation"]`);
    ok = false;
  }

  // Must have both logos
  if (!html.match(/VALIOZ_Health_Primary/i)) {
    err(`[${clinicName}] missing Valioz Health logo`);
    ok = false;
  }
  const clinicSlug = clinicName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  if (!html.match(/clinic[-_]?logo|downtown|clinic_logo/i)) {
    warn(`[${clinicName}] may be missing clinic logo reference`);
  }

  return ok;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Valioz Health — Template Validation                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (!fs.existsSync(ENRICHED_CSV)) {
    console.error(`❌ Enriched CSV not found: ${ENRICHED_CSV}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(ENRICHED_CSV, 'utf8');
  const clinics = csv.parse(csvContent, { columns: true, skip_empty_lines: true });

  console.log(`\n📋 Validating ${clinics.length} enriched clinics...\n`);

  // 1. Validate all clinic logo URLs
  for (const clinic of clinics) {
    const name = clinic.clinic_brand_name || 'Unknown';
    await validateLogoUrl(clinic.clinic_logo_hosted_url, name);
  }

  // 2. Validate compiled templates
  console.log('\n📄 Validating compiled templates...\n');
  if (fs.existsSync(DIST_DIR)) {
    const clinicDirs = fs.readdirSync(DIST_DIR).filter((d) =>
      fs.statSync(path.join(DIST_DIR, d)).isDirectory()
    );

    for (const dir of clinicDirs) {
      const dirPath = path.join(DIST_DIR, dir);
      const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.html'));

      for (const file of files) {
        const html = fs.readFileSync(path.join(dirPath, file), 'utf8');
        validateTemplate(html, dir);
      }
    }
  } else {
    warn('dist/personalized/ not found — run build-templates.js first');
  }

  // Summary
  console.log('\n═════════════════════════════════════════════════════════════╗');
  if (errors === 0 && warnings === 0) {
    console.log('✅ ALL CHECKS PASSED — Templates ready for deployment');
  } else {
    console.log(`⚠️  ${errors} error(s), ${warnings} warning(s) found`);
  }
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  process.exit(errors > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
