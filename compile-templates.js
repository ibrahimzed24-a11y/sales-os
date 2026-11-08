/**
 * Compile the five master templates for the Hostinger template library.
 *
 * Uses the enriched Barrie Dental Arts record (or the first enriched clinic)
 * so the output always contains a real Brand 2 logo next to the Valioz logo.
 * Run: node compile-templates.js
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { buildClinic, htmlToText } = require('./lib/builder');

const ROOT = __dirname;
const ENRICHED_CSV = path.join(ROOT, 'data', 'dental-clinics-enriched.csv');
const OUTPUT_DIR = path.join(ROOT, 'compiled');

if (!fs.existsSync(ENRICHED_CSV)) {
  console.error(`❌ Enriched CSV not found: ${ENRICHED_CSV}`);
  console.error('Run: npm run enrich');
  process.exit(1);
}

const clinics = parse(fs.readFileSync(ENRICHED_CSV, 'utf8'), {
  columns: true,
  skip_empty_lines: true,
  relax_column_count: true,
});

const clinic =
  clinics.find((row) => /barrie dental arts/i.test(row.clinic_brand_name || '')) || clinics[0];

if (!clinic || !clinic.clinic_logo_hosted_url) {
  console.error('❌ No enriched clinic with a logo found. Run npm run enrich first.');
  process.exit(1);
}

fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const { files } = buildClinic(clinic, { outDir: OUTPUT_DIR, flat: true });

for (const { step, file, html } of files) {
  const words = htmlToText(html).split(/\s+/).filter(Boolean).length;
  console.log(`✓ ${step.output} (${html.length} bytes, ${words} words)`);
}

console.log(`\n✅ Compiled ${files.length} master templates for ${clinic.clinic_brand_name} → ${OUTPUT_DIR}/`);
