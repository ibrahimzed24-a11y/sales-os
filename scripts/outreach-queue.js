/**
 * Pick the next 10 non-DSO clinics, render their welcome email, and write the
 * persistent outreach tracker. Sending happens in Hostinger webmail: schedule
 * each message at the Cairo time printed here, which equals 08:00 clinic-local.
 *
 *   node scripts/outreach-queue.js --date 2026-11-10 --dry-run
 *   node scripts/outreach-queue.js --date 2026-11-10
 *   node scripts/outreach-queue.js --date 2026-11-11 --only slug-a,slug-b
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { buildClinic } = require('../lib/builder');
const { STEPS, subjectForStep, slugify } = require('../lib/sequence-content');

const ROOT = path.join(__dirname, '..');
const RESEARCH = path.join(ROOT, 'data', 'clinic-research.csv');
const ENRICHED = path.join(ROOT, 'data', 'dental-clinics-enriched.csv');
const DECISION_MAKERS = path.join(ROOT, 'data', 'decision-makers.csv');
const TRACKER = path.join(ROOT, 'canadian_clinics_outreach_tracker.csv');
const OUT_DIR = path.join(ROOT, 'dist', 'outreach-queue');

const TRACKER_COLUMNS = [
  'Clinic Name',
  'Province / City',
  'Local Time Zone',
  'Decision Maker Name',
  'Decision Maker Title',
  'Email Address',
  'Subject Line',
  'Sent Timestamp (UTC & Local)',
  'Status',
  'Notes',
];

const ZONES = {
  ON: ['America/Toronto', 'ET'],
  QC: ['America/Toronto', 'ET'],
  NS: ['America/Halifax', 'AT'],
  NB: ['America/Halifax', 'AT'],
  PE: ['America/Halifax', 'AT'],
  BC: ['America/Vancouver', 'PT'],
  AB: ['America/Edmonton', 'MT'],
  MB: ['America/Winnipeg', 'CT'],
  SK: ['America/Regina', 'CST'],
};

// Clinics already used for layout tests, or whose ownership needs confirming.
const SKIP = new Set(
  [
    'Apple Dental Group',
    'Barrie Dental Arts',
    'Dundas Ossington Dentistry',
    'Fraserview Dentist',
    // Vancouver City Centre, Thunderbird and King George share one owner.
    'Thunderbird Dental Group',
    'King George Station Dental',
  ].map(slugify)
);

const args = process.argv.slice(2);
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const date = valueOf('--date') || nextActiveDate();
const count = Number(valueOf('--count') || 10);
const perProvince = Number(valueOf('--per-province') || 3);
const only = new Set((valueOf('--only') || '').split(',').map(slugify).filter(Boolean));
const status = valueOf('--status') || 'Pending';
const dryRun = args.includes('--dry-run');

function nextActiveDate() {
  const now = new Date();
  const cairo = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now);
  const part = (type) => cairo.find((p) => p.type === type).value;
  const day = new Date(`${part('year')}-${part('month')}-${part('day')}T12:00:00Z`);
  for (let i = 0; i < 8; i += 1) {
    const weekday = day.getUTCDay();
    if ([2, 3, 4].includes(weekday)) return day.toISOString().slice(0, 10);
    day.setUTCDate(day.getUTCDate() + 1);
  }
  throw new Error('No Tue/Wed/Thu found');
}

function localEightToUtc(dateStr, timeZone) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const desired = Date.UTC(year, month - 1, day, 8, 0, 0);
  let guess = desired;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  for (let i = 0; i < 2; i += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(guess)).map((p) => [p.type, p.value])
    );
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute),
      Number(parts.second)
    );
    guess += desired - asUtc;
  }
  return new Date(guess);
}

function formatters(timeZone, label) {
  return (instant) => ({
    local: `${new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(instant)} ${label}`,
    cairo: new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Cairo',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(instant),
  });
}

function readCsv(file, optional = false) {
  if (optional && !fs.existsSync(file)) return [];
  return parse(fs.readFileSync(file, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
}

function emailFor(row) {
  return (row.clinic_email || '').trim();
}

function decisionMakerFor(name, map) {
  const hit = map.get(slugify(name));
  if (hit) {
    return {
      name: hit.decision_maker_name,
      title: hit.decision_maker_title,
      source: hit.source_url,
    };
  }
  return {
    name: 'Practice Manager (name not published)',
    title: 'Practice Manager',
    source: '',
  };
}

function greetingFor(name) {
  if (!name.startsWith('Dr.')) return 'there';
  const parts = name.split(/\s+/);
  return parts.length > 2 ? `Dr. ${parts[parts.length - 1]}` : name;
}

function eligible(research, enriched) {
  const email = emailFor(enriched);
  const status = (research.send_status || '').toLowerCase();
  const verification = (research.verification_status || '').trim();
  if (!email.includes('@')) return false;
  if (SKIP.has(slugify(research.clinic_brand_name))) return false;
  if ((enriched.parent_dso || '').trim() !== 'Independent') return false;
  if (status.startsWith('hold') || status.startsWith('review')) return false;
  if (!verification || verification === 'Not verified') return false;
  if (/multi-site/i.test(verification)) return false;
  return true;
}

function pick(researchRows, enrichedByName) {
  const rows = researchRows
    .map((research) => ({
      research,
      enriched: enrichedByName.get(slugify(research.clinic_brand_name)),
    }))
    .filter(({ research, enriched }) => enriched && eligible(research, enriched));

  rows.sort((a, b) => {
    const score = Number(b.research.total_0_100 || 0) - Number(a.research.total_0_100 || 0);
    return score || a.research.clinic_brand_name.localeCompare(b.research.clinic_brand_name);
  });

  if (only.size) {
    const curated = rows.filter(({ research }) => only.has(slugify(research.clinic_brand_name)));
    if (curated.length !== only.size) {
      const found = new Set(curated.map(({ research }) => slugify(research.clinic_brand_name)));
      throw new Error(`--only did not match: ${[...only].filter((s) => !found.has(s)).join(', ')}`);
    }
    return curated.slice(0, count);
  }

  const chosen = [];
  const byProvince = {};
  for (const row of rows) {
    const province = row.research.province;
    if ((byProvince[province] || 0) >= perProvince) continue;
    byProvince[province] = (byProvince[province] || 0) + 1;
    chosen.push(row);
    if (chosen.length === count) return chosen;
  }
  for (const row of rows) {
    if (chosen.includes(row)) continue;
    chosen.push(row);
    if (chosen.length === count) break;
  }
  return chosen;
}

function main() {
  const researchRows = readCsv(RESEARCH);
  const enrichedRows = readCsv(ENRICHED);
  const enrichedByName = new Map(
    enrichedRows.map((row) => [slugify(row.clinic_brand_name), row])
  );
  const decisionMakers = new Map(
    readCsv(DECISION_MAKERS, true).map((row) => [slugify(row.clinic_brand_name), row])
  );

  const trackerRows = fs.existsSync(TRACKER) ? readCsv(TRACKER) : [];
  const contacted = new Set(trackerRows.map((row) => slugify(row['Clinic Name'])));
  const available = researchRows.filter(
    (row) => !contacted.has(slugify(row.clinic_brand_name))
  );
  const queue = pick(available, enrichedByName);

  if (!queue.length) throw new Error('No eligible clinics left. Add more verified leads.');

  const dateDir = path.join(OUT_DIR, date);
  fs.mkdirSync(dateDir, { recursive: true });

  const sends = queue.map(({ research, enriched }) => {
    const zone = ZONES[research.province];
    if (!zone) throw new Error(`No time zone for ${research.province}`);
    const [timeZone, label] = zone;
    const instant = localEightToUtc(date, timeZone);
    const stamp = formatters(timeZone, label)(instant);
    const dm = decisionMakerFor(research.clinic_brand_name, decisionMakers);
    const greeting = greetingFor(dm.name);
    const step = STEPS[0];
    const built = buildClinic(enriched, {
      outDir: dateDir,
      contactFirstName: greeting,
      steps: [step],
    });
    const subject = subjectForStep(step, enriched, {
      contactFirstName: greeting === 'there' ? '' : greeting,
    });
    return {
      clinic: research.clinic_brand_name,
      slug: built.slug,
      to: emailFor(enriched),
      province: research.province,
      city: research.city,
      timeZone,
      label,
      local: stamp.local,
      utc: instant.toISOString().replace('.000', ''),
      cairo: stamp.cairo,
      decisionMaker: dm.name,
      decisionMakerTitle: dm.title,
      decisionMakerSource: dm.source,
      score: research.total_0_100,
      verification: research.verification_status,
      subject,
      htmlPath: path.relative(ROOT, built.files[0].file),
    };
  });

  const manifest = path.join(dateDir, 'manifest.json');
  fs.writeFileSync(manifest, `${JSON.stringify({ date, sends }, null, 2)}\n`);

  console.log(`\n${dryRun ? 'DRY RUN' : 'PREPARED'}: ${sends.length} clinics for ${date}\n`);
  for (const send of sends) {
    console.log(`${send.clinic} (${send.province}) — ${send.decisionMaker}`);
    console.log(`  to: ${send.to}`);
    console.log(`  subject: ${send.subject}`);
    console.log(`  send: ${send.local} = ${send.utc} = ${send.cairo} Cairo`);
    console.log(`  html: ${path.relative(ROOT, send.htmlPath)}`);
  }
  console.log(`\nManifest: ${path.relative(ROOT, manifest)}`);

  if (dryRun) {
    console.log('\nNothing written to the tracker. Re-run without --dry-run to queue.');
    return;
  }

  const rows = sends.map((send) => ({
    'Clinic Name': send.clinic,
    'Province / City': `${send.province} / ${send.city}`,
    'Local Time Zone': send.label,
    'Decision Maker Name': send.decisionMaker,
    'Decision Maker Title': send.decisionMakerTitle,
    'Email Address': send.to,
    'Subject Line': send.subject,
    'Sent Timestamp (UTC & Local)': `${send.utc} / ${send.local}`,
    Status: status,
    Notes: [
      `Priority ${send.score}/100`,
      send.verification,
      `Cairo send ${send.cairo}`,
      send.decisionMakerSource ? `Source ${send.decisionMakerSource}` : '',
    ]
      .filter(Boolean)
      .join('; '),
  }));

  const existing = trackerRows.length ? trackerRows : [];
  fs.writeFileSync(
    TRACKER,
    stringify([...existing, ...rows], { header: true, columns: TRACKER_COLUMNS })
  );
  console.log(`Tracker: ${path.relative(ROOT, TRACKER)} (+${rows.length})`);
}

main();
