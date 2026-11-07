/**
 * =============================================================================
 * Valioz Health — Lead Logo Enrichment & Optimization Engine
 * =============================================================================
 * Multi-tier logo discovery waterfall for dental clinics.
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
const { stringify: csvStringify } = require('csv-stringify/sync');
const fetch = require('node-fetch');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const ASSETS_DIR = path.join(ROOT, 'assets', 'clinic-logos');
const INPUT_CSV = path.join(DATA_DIR, 'dental-clinics.csv');
const OUTPUT_CSV = path.join(DATA_DIR, 'dental-clinics-enriched.csv');

fs.mkdirSync(ASSETS_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

const GENERIC_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'shaw.ca', 'videotron.ca', 'bell.net', 'rogers.com',
  'telus.net', 'icloud.com', 'aol.com', 'live.com',
];

const DSO_LOGOS = {
  '123Dentist': 'https://raw.githubusercontent.com/ibrahimzed24-a11y/sales-os/main/assets/clinic-logos/dso-123dentist.png',
  'dentalcorp': 'https://raw.githubusercontent.com/ibrahimzed24-a11y/sales-os/main/assets/clinic-logos/dso-dentalcorp.png',
};

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractDomainFromEmail(email) {
  if (!email) return null;
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  const domain = parts[1].toLowerCase();
  if (GENERIC_DOMAINS.includes(domain)) return null;
  return domain;
}

async function fetchText(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Valioz-Logo-Bot/1.0; +https://health.valioz.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
      timeout: 15000,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    return null;
  }
}

async function fetchBuffer(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Valioz-Logo-Bot/1.0; +https://health.valioz.com)',
      },
      timeout: 15000,
    });
    if (!res.ok) return null;
    return await res.buffer();
  } catch (e) {
    return null;
  }
}

async function discoverDomain(clinic) {
  if (clinic.direct_clinic_url && clinic.direct_clinic_url.trim()) {
    return clinic.direct_clinic_url.trim();
  }

  const domain = extractDomainFromEmail(clinic.clinic_email);
  if (domain) {
    for (const proto of ['https://', 'http://']) {
      const url = proto + domain + '/';
      const ok = await fetchText(url);
      if (ok) return url;
    }
    return domain;
  }

  return null;
}

function extractLogoCandidates(html) {
  const candidates = [];

  // 1. Schema.org JSON-LD logo
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatches) {
    for (const m of jsonLdMatches) {
      try {
        const content = m.replace(/<script[^>]*>|<\/script>/gi, '').trim();
        const data = JSON.parse(content);
        const walk = (obj) => {
          if (obj && typeof obj === 'object') {
            if (obj.logo && typeof obj.logo === 'string') candidates.push(obj.logo);
            if (obj.image && typeof obj.image === 'string') candidates.push(obj.image);
            for (const k of Object.keys(obj)) walk(obj[k]);
          }
        };
        walk(data);
      } catch (_) {}
    }
  }

  // 2. Header/Navbar img tags with logo/brand in src/alt/class
  const imgMatches = html.match(/<img[^>]+>/gi);
  if (imgMatches) {
    for (const m of imgMatches) {
      const srcMatch = m.match(/src=["']([^"']+)["']/i);
      const altMatch = m.match(/alt=["']([^"']+)["']/i);
      const classMatch = m.match(/class=["']([^"']+)["']/i);
      if (srcMatch) {
        const src = srcMatch[1];
        const alt = (altMatch && altMatch[1]) || '';
        const cls = (classMatch && classMatch[1]) || '';
        const combined = (src + ' ' + alt + ' ' + cls).toLowerCase();
        if (combined.includes('logo') || combined.includes('brand')) {
          candidates.push(src);
        }
      }
    }
  }

  // 3. Apple touch icon / og:image
  const appleMatch = html.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i);
  if (appleMatch) candidates.push(appleMatch[1]);
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (ogMatch) candidates.push(ogMatch[1]);

  return candidates.filter(Boolean);
}

function resolveUrl(base, href) {
  try {
    return new URL(href, base).href;
  } catch (_) {
    return href;
  }
}

async function discoverLogoUrl(clinic, domainUrl) {
  const html = await fetchText(domainUrl);
  if (!html) return null;

  const candidates = extractLogoCandidates(html);

  for (const cand of candidates) {
    const abs = resolveUrl(domainUrl, cand);
    if (!abs.startsWith('http')) continue;
    if (/\.(ico|svg|woff|ttf|eot)$/i.test(abs)) continue;
    try {
      const res = await fetch(abs, { method: 'HEAD', timeout: 8000 });
      if (res.ok && res.headers.get('content-type') && res.headers.get('content-type').startsWith('image/')) {
        return abs;
      }
    } catch (_) {}
  }

  return null;
}

async function downloadAndOptimizeLogo(url, slug) {
  const buf = await fetchBuffer(url);
  if (!buf) return null;

  try {
    const out = await sharp(buf)
      .png({ quality: 90 })
      .resize(180, 60, { fit: 'inside', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .toBuffer();

    const outPath = path.join(ASSETS_DIR, `${slug}.png`);
    fs.writeFileSync(outPath, out);

    return `https://raw.githubusercontent.com/ibrahimzed24-a11y/sales-os/main/assets/clinic-logos/${slug}.png`;
  } catch (e) {
    console.error(`  [sharp] failed for ${slug}: ${e.message}`);
    return null;
  }
}

function getDSOLogo(parentDso) {
  return DSO_LOGOS[parentDso] || null;
}

async function generateMonogramPng(clinicName) {
  const letters = clinicName
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
    || '??';

  const buf = await sharp({
    create: {
      width: 180,
      height: 60,
      channels: 3,
      background: { r: 240, g: 240, b: 240 },
    },
  })
    .png()
    .toBuffer();

  const outPath = path.join(ASSETS_DIR, `${slugify(clinicName)}-monogram.png`);
  fs.writeFileSync(outPath, buf);

  return `https://raw.githubusercontent.com/ibrahimzed24-a11y/sales-os/main/assets/clinic-logos/${slugify(clinicName)}-monogram.png`;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Valioz Health — Lead Logo Enrichment Pipeline              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const csvContent = fs.readFileSync(INPUT_CSV, 'utf8');
  const records = csv.parse(csvContent, { columns: true, skip_empty_lines: true, relax_column_count: true });
  console.log(`Loaded ${records.length} clinics from ${INPUT_CSV}\n`);

  const enriched = [];

  for (const clinic of records) {
    const name = clinic.clinic_brand_name || 'Unknown Clinic';
    const slug = slugify(name);
    console.log(`[${slug}] ${name}`);

    let logoUrl = null;
    let logoSourceTier = 'FALLBACK';
    let logoVerifiedStatus = 'FALLBACK';

    // --- Tier 1: Domain discovery ---
    const domainUrl = await discoverDomain(clinic);
    if (domainUrl) {
      console.log(`  Tier 1 domain: ${domainUrl}`);

      // --- Tier 2: Logo extraction ---
      const extractedUrl = await discoverLogoUrl(clinic, domainUrl);
      if (extractedUrl) {
        logoUrl = extractedUrl;
        logoSourceTier = 'WEBSITE_HEADER';
        logoVerifiedStatus = 'OK';
        console.log(`  Tier 2 logo: ${extractedUrl}`);
      }
    }

    // --- Tier 3: Download & optimize ---
    let hostedUrl = null;
    if (logoUrl) {
      hostedUrl = await downloadAndOptimizeLogo(logoUrl, slug);
      if (hostedUrl) {
        logoVerifiedStatus = 'OK';
        console.log(`  Tier 3 hosted: ${hostedUrl}`);
      }
    }

    // --- Tier 4: DSO / Monogram fallback ---
    if (!hostedUrl) {
      const dsoLogo = getDSOLogo(clinic.parent_dso);
      if (dsoLogo) {
        hostedUrl = dsoLogo;
        logoSourceTier = 'DSO_FALLBACK';
        logoVerifiedStatus = 'FALLBACK';
        console.log(`  Tier 4 DSO: ${hostedUrl}`);
      } else {
        try {
          const monoBuf = await generateMonogramPng(name);
          const monoPath = path.join(ASSETS_DIR, `${slug}-monogram.png`);
          fs.writeFileSync(monoPath, monoBuf);
          hostedUrl = `https://raw.githubusercontent.com/ibrahimzed24-a11y/sales-os/main/assets/clinic-logos/${slug}-monogram.png`;
          logoSourceTier = 'MONOGRAM_FALLBACK';
          logoVerifiedStatus = 'FALLBACK';
          console.log(`  Tier 4 monogram: ${hostedUrl}`);
        } catch (e) {
          console.error(`  Monogram failed: ${e.message}`);
        }
      }
    }

    enriched.push({
      ...clinic,
      resolved_website_url: domainUrl || '',
      clinic_logo_raw_url: logoUrl || '',
      clinic_logo_hosted_url: hostedUrl || '',
      logo_source_tier: logoSourceTier,
      logo_verified_status: logoVerifiedStatus,
    });

    await new Promise((r) => setTimeout(r, 300));
  }

  const out = csvStringify(enriched, { header: true });
  fs.writeFileSync(OUTPUT_CSV, out, 'utf8');
  console.log(`\n✅ Enriched ${enriched.length} clinics → ${OUTPUT_CSV}`);

  const tierCounts = {};
  enriched.forEach((r) => {
    tierCounts[r.logo_source_tier] = (tierCounts[r.logo_source_tier] || 0) + 1;
  });
  console.log('\n📊 Logo Source Tier Summary:');
  for (const [tier, count] of Object.entries(tierCounts)) {
    console.log(`   ${tier}: ${count}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
