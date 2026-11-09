/**
 * Per-clinic research layer imported from the lead-scoring workbook.
 *
 * The enriched CSV carries the clinic identity and logo; this file carries the
 * scored/verified facts that make the copy specific. Keeping it separate means
 * `npm run enrich` can rewrite the logo columns without touching research.
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const RESEARCH_CSV = path.join(__dirname, '..', 'data', 'clinic-research.csv');
let cache;

function normalizeName(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function loadResearch() {
  if (cache) return cache;
  cache = new Map();
  if (!fs.existsSync(RESEARCH_CSV)) return cache;
  const rows = parse(fs.readFileSync(RESEARCH_CSV, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
  for (const row of rows) cache.set(normalizeName(row.clinic_brand_name), row);
  return cache;
}

function isTrue(value) {
  return String(value || '').toLowerCase() === 'true';
}

function formatCount(value) {
  return String(Number(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function websiteState(status = '') {
  const text = String(status).toLowerCase();
  if (!text || text.includes('not verified')) return 'unknown';
  if (
    text.includes('unreachable') ||
    text.includes('did not load') ||
    text.includes('holding page') ||
    text.includes('placeholder') ||
    text.includes('does not resolve')
  ) {
    return 'broken';
  }
  if (
    text.includes('website live') ||
    text.includes('website found') ||
    text.includes('multi-site group')
  ) {
    return 'live';
  }
  return 'unknown';
}

function reputationLineFor(clinic) {
  const rating = Number(clinic.google_rating);
  const reviews = Number(clinic.google_review_count);
  // Only show reputation when it helps: weak ratings or tiny samples read as
  // an insult in an outreach email.
  return rating >= 4 && reviews >= 50
    ? `${rating.toFixed(1)}★ from ${formatCount(reviews)} Google reviews`
    : '';
}

function coverageLineFor(clinic) {
  return isTrue(clinic.cdcp_participating) ? 'CDCP provider' : '';
}

function proofLineFor(clinic) {
  return [reputationLineFor(clinic), coverageLineFor(clinic)].filter(Boolean).join(' · ');
}

function siteLineFor(state) {
  if (state === 'live') return 'Live website found';
  if (state === 'broken') return 'No working clinic site found at our check';
  return '';
}

function searchTermFor(row, clinic) {
  const hook = String(row.keyword_hook || '').split(':')[0].trim();
  if (hook) return hook.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const city = String(clinic.city || '').trim();
  return city ? `dentist ${city}`.toLowerCase() : 'dentist near me';
}

function researchFor(clinic = {}) {
  const row = loadResearch().get(normalizeName(clinic.clinic_brand_name));
  if (!row) {
    return {
      matched: false,
      score: null,
      tier: '',
      verificationStatus: '',
      websiteState: 'unknown',
      proofLine: proofLineFor(clinic),
      reputationLine: reputationLineFor(clinic),
      coverageLine: coverageLineFor(clinic),
      siteLine: '',
      searchTerm: searchTermFor({}, clinic),
      evidenceHook: '',
      keywordHook: '',
      sendStatus: '',
      verifiedOn: '',
    };
  }

  const state = websiteState(row.verification_status);
  return {
    matched: true,
    score: row.total_0_100 ? Number(row.total_0_100) : null,
    tier: row.tier || '',
    verificationStatus: row.verification_status || '',
    websiteState: state,
    proofLine: proofLineFor(clinic),
    reputationLine: reputationLineFor(clinic),
    coverageLine: coverageLineFor(clinic),
    siteLine: siteLineFor(state),
    searchTerm: searchTermFor(row, clinic),
    evidenceHook: row.evidence_hook || '',
    keywordHook: row.keyword_hook || '',
    sendStatus: row.send_status || '',
    verifiedOn: row.verified_on || '',
  };
}

function researchCard({ reputationLine = '', coverageLine = '', siteLine = '' } = {}) {
  const row = (label, value) => `<tr>
        <td class="barlabel" width="105" valign="top" style="padding:8px 12px 8px 0;font-size:12px;color:#667D88;font-weight:bold;">${label}</td>
        <td valign="top" style="padding:8px 0;font-size:13px;color:#142B42;line-height:1.5;">${value}</td>
      </tr>`;
  const rows = [];
  if (reputationLine) rows.push(row('Reputation', reputationLine));
  if (coverageLine) rows.push(row('Coverage', coverageLine));
  if (siteLine) rows.push(row('Web presence', siteLine));
  if (!rows.length) return '';

  return `<div style="border:1px solid #E2ECEB;border-radius:12px;padding:18px 20px;margin-top:24px;">
      <div style="font-size:11px;font-weight:800;letter-spacing:2.1px;color:#009E9E;text-transform:uppercase;">What we noticed</div>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:6px;">
        ${rows.join('\n        ')}
      </table>
    </div>`;
}

module.exports = { researchFor, researchCard, websiteState, proofLineFor, reputationLineFor, coverageLineFor, siteLineFor };

if (require.main === module) {
  const assert = require('assert');
  assert.strictEqual(websiteState('Website live'), 'live');
  assert.strictEqual(websiteState('Website live; brand name differs'), 'live');
  assert.strictEqual(websiteState('Website unreachable'), 'broken');
  assert.strictEqual(websiteState('Domain does not resolve'), 'broken');
  assert.strictEqual(websiteState(''), 'unknown');
  assert.strictEqual(websiteState('Not verified'), 'unknown');
  console.log('clinic-research self-check passed');
}
