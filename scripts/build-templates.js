#!/usr/bin/env node
/**
 * Valioz Health — Build Templates (Dual-Brand HTML Compiler)
 *
 * Reads the enriched clinic CSV and writes five personalized HTML files per
 * clinic under dist/personalized/<slug>/. All rendering, copy and assertions
 * live in lib/builder.js so every entry point produces identical output.
 *
 * Run: npm run build
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { buildClinic } = require('../lib/builder');

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist', 'personalized');
const ENRICHED_CSV = path.join(ROOT, 'data', 'dental-clinics-enriched.csv');

function main() {
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

  // Build output is disposable; removing it prevents stale clinic slugs from
  // earlier data revisions surviving into the deployed site.
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });

  let fileCount = 0;
  for (const clinic of clinics) {
    const { slug, files } = buildClinic(clinic, { outDir: DIST_DIR });
    fileCount += files.length;
    console.log(`✓ ${clinic.clinic_brand_name} → ${slug}/ (${files.length} templates)`);
  }

  console.log(`\n✅ Built ${fileCount} templates for ${clinics.length} clinics → ${DIST_DIR}/`);
}

try {
  main();
} catch (error) {
  console.error(`\n❌ ${error.stack || error.message}`);
  process.exit(1);
}
