#!/usr/bin/env node
/**
 * Valioz Health — Lead Logo Enrichment & Optimization Engine
 *
 * For every clinic:
 *   1. Resolve a website (direct URL, email domain, then best-effort search).
 *   2. Score logo candidates (JSON-LD, header <img>, icons, og:image).
 *   3. Reject photos, badges, Invisalign/provider marks and other non-logos.
 *   4. Convert SVG/WebP/JPEG to a <=180x60 PNG, preferably under 40 KB.
 *   5. Fall back to the DSO mark or a generated clinic monogram.
 *
 * Outputs data/dental-clinics-enriched.csv and assets/clinic-logos/<slug>.png
 *
 * Usage:
 *   node scripts/enrich-clinic-logos.js
 *   node scripts/enrich-clinic-logos.js --only "Barrie Dental Arts,Apple Dental Group"
 *   node scripts/enrich-clinic-logos.js --limit 10 --concurrency 4
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify: stringifyCsv } = require('csv-stringify/sync');
const fetch = require('node-fetch');
const sharp = require('sharp');
const { slugify } = require('../lib/sequence-content');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const ASSETS_DIR = path.join(ROOT, 'assets', 'clinic-logos');
const INPUT_CSV = path.join(DATA_DIR, 'dental-clinics.csv');
const OUTPUT_CSV = path.join(DATA_DIR, 'dental-clinics-enriched.csv');
const OVERRIDES_FILE = path.join(ROOT, 'config', 'logo-overrides.json');
const HOSTED_BASE =
  process.env.LOGO_BASE_URL ||
  'https://raw.githubusercontent.com/ibrahimzed24-a11y/sales-os/main/assets/clinic-logos';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 ValiozLogoBot/2.0';

const GENERIC_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.ca', 'hotmail.com', 'outlook.com',
  'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'ymail.com',
  'shaw.ca', 'videotron.ca', 'bell.net', 'rogers.com', 'telus.net', 'sasktel.net',
  'eastlink.ca', 'cogeco.ca', 'xplornet.ca', 'protonmail.com', 'proton.me',
]);

const GENERIC_NAME_WORDS = new Set([
  'dental', 'dentist', 'dentistry', 'dentaire', 'dentistes', 'clinique', 'clinic',
  'centre', 'center', 'family', 'group', 'care', 'health', 'the', 'and', 'at',
  'of', 'inc', 'ltd', 'professional', 'corporation', 'associates', 'association',
  'arts', 'smiles', 'smile', 'orthodontics', 'orthodontie', 'endodontics',
  'periodontics', 'paediatric', 'pediatric', 'village', 'square', 'street',
  'road', 'avenue', 'drive', 'boulevard', 'north', 'south', 'east', 'west',
  'new', 'old', 'downtown', 'uptown', 'midtown', 'westgate', 'bay', 'park',
  'hill', 'hills', 'lake', 'lakeside', 'river', 'riverside', 'mountain',
  'springs', 'trails', 'station', 'plaza', 'mall', 'market', 'medical',
  'doctors', 'doctor', 'day',
]);

const BAD_WORDS = [
  'invisalign', 'provider', 'badge', 'award', 'seal', 'certif', 'partner',
  'powered', 'review', 'rating', 'social', 'facebook', 'instagram', 'twitter',
  'linkedin', 'youtube', 'pinterest', 'tiktok', 'sprite', 'avatar', 'photo',
  'gallery', 'team', 'staff', 'doctor', 'dentist-photos', 'hero', 'banner',
  'slider', 'background', 'interior', 'office', 'placeholder', 'default',
  'payment', 'insurance', 'visa', 'mastercard', 'amex', 'hours', 'map',
  'phone', 'email', 'arrow', 'chevron', 'menu', 'search', 'cart', 'play',
  'logo-cloud', 'sponsor', 'adobe', 'stock', '123dentist', 'dentalcorp',
  'address', 'marker', 'pin-icon', 'clock', 'calendar', 'message', 'envelope', 'chat',
];

const DIRECTORY_HOSTS = [
  'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com',
  'youtube.com', 'pinterest.com', 'tiktok.com', 'yelp.ca', 'yelp.com',
  'yellowpages.ca', 'yellowpages.com', 'ratemds.com', 'healthgrades.com',
  'google.com', 'maps.google.com', 'mapquest.com', 'tripadvisor.ca',
  'tripadvisor.com', 'wikipedia.org', 'indeed.com', 'glassdoor.ca',
  'glassdoor.com', 'zhihu.com', 'github.com', 'bing.com', 'duckduckgo.com',
  'dentistarium.com', 'opencare.com', 'bookwithapex.com',
];

const args = parseArgs(process.argv.slice(2));
const overrides = fs.existsSync(OVERRIDES_FILE)
  ? JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8'))
  : {};

fs.mkdirSync(ASSETS_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeName(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeUrl(value) {
  if (!value) return null;
  let url = String(value).trim();
  if (!url || /^(mailto:|tel:|javascript:|#)/i.test(url)) return null;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.endsWith('/') && !path.extname(parsed.pathname)) {
      parsed.pathname += '/';
    }
    return parsed.href;
  } catch {
    return null;
  }
}

function resolveUrl(base, value) {
  if (!value) return null;
  try {
    return new URL(value, base).href;
  } catch {
    return null;
  }
}

function extractEmailDomain(email) {
  if (!email) return null;
  const parts = String(email).trim().toLowerCase().split('@');
  if (parts.length !== 2) return null;
  if (GENERIC_DOMAINS.has(parts[1])) return null;
  // A booking directory email domain is not the clinic's own website.
  if (isDirectory(`https://${parts[1]}/`)) return null;
  return parts[1];
}

function clinicTokens(name) {
  return normalizeName(name)
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !GENERIC_NAME_WORDS.has(word));
}

function looksLikeImage(buffer) {
  if (!buffer || buffer.length < 12) return false;
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return true;
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return true;
  if (buffer.slice(0, 3).toString() === 'GIF') return true;
  if (buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') return true;
  if (/^ftyp(avif|avis|heic|heix|mif1|msf1)/.test(buffer.slice(4, 12).toString('ascii'))) return true;
  const head = buffer.slice(0, 300).toString('utf8').trim().toLowerCase();
  return head.startsWith('<svg') || head.startsWith('<?xml') || head.includes('<svg');
}

async function fetchText(url, referer) {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...(referer ? { referer } : {}),
      },
      timeout: 15000,
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const type = (res.headers.get('content-type') || '').toLowerCase();
    if (type && !/text|html|xml|json/.test(type)) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchBuffer(url, referer) {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': UA,
        accept: 'image/png,image/webp,image/svg+xml,image/jpeg,image/gif,image/*;q=0.8',
        ...(referer ? { referer } : {}),
      },
      timeout: 20000,
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const length = Number(res.headers.get('content-length') || 0);
    if (length > 10 * 1024 * 1024) return null;
    const buffer = await res.buffer();
    if (buffer.length > 10 * 1024 * 1024) return null;
    if (!looksLikeImage(buffer)) return null;
    return buffer;
  } catch {
    return null;
  }
}

const pageCache = new Map();

async function fetchPage(url) {
  if (!url) return null;
  if (!pageCache.has(url)) {
    pageCache.set(
      url,
      (async () => {
        const html = await fetchText(url);
        if (!html) return null;
        if (!/<html|<body|<img|<header|<nav|<meta|<link/i.test(html)) return null;
        return html;
      })()
    );
  }
  return pageCache.get(url);
}

// ---------------------------------------------------------------------------
// Website discovery
// ---------------------------------------------------------------------------

function searchLinks(text, base) {
  const links = [];
  const decoded = text.replace(/&amp;/g, '&');
  const ddg = /[?&]uddg=([^&"']+)/g;
  let match;
  while ((match = ddg.exec(decoded))) {
    try {
      links.push(decodeURIComponent(match[1]));
    } catch {
      /* ignore malformed redirect */
    }
  }
  const abs = /href=["'](https?:\/\/[^"']+)["']/g;
  while ((match = abs.exec(decoded))) links.push(match[1]);
  const rss = /<link>(https?:\/\/[^<]+)<\/link>/g;
  while ((match = rss.exec(decoded))) links.push(match[1]);
  return [...new Set(
    links
      .map((link) => link.replace(/&amp;/g, '&').trim())
      .map((link) => resolveUrl(base, link))
      .filter(Boolean)
  )];
}

function isDirectory(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return DIRECTORY_HOSTS.some((bad) => host === bad || host.endsWith(`.${bad}`));
  } catch {
    return true;
  }
}

async function findClinicWebsite(clinic) {
  const tokens = clinicTokens(clinic.clinic_brand_name || '');
  if (!tokens.length) return null;

  const query = `"${clinic.clinic_brand_name}" "${clinic.city || ''}" "${clinic.province_state || ''}" official website`;
  const engines = [
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    `https://www.bing.com/search?format=rss&mkt=en-CA&setlang=en&q=${encodeURIComponent(query)}`,
  ];

  for (const engine of engines) {
    const text = await fetchText(engine);
    if (!text) continue;
    for (const link of searchLinks(text, engine).slice(0, 10)) {
      if (isDirectory(link)) continue;
      const html = await fetchPage(link);
      if (!html) continue;
      const plain = html.replace(/<[^>]+>/g, ' ').toLowerCase();
      if (tokens.some((token) => plain.includes(token))) return link;
    }
  }
  return null;
}

async function discoverDomain(clinic) {
  const direct = normalizeUrl(clinic.direct_clinic_url);
  const emailDomain = extractEmailDomain(clinic.clinic_email);
  const emailCandidates = emailDomain
    ? [`https://${emailDomain}/`, `https://www.${emailDomain}/`]
    : [];

  // Prefer HTTPS when the source data only lists an http:// address.
  if (direct && direct.startsWith('http://')) {
    const secure = direct.replace(/^http:\/\//i, 'https://');
    if (await fetchPage(secure)) return secure;
  }

  // A directory profile can be Cloudflare-blocked. Prefer any clinic domain
  // that actually answers before falling back to the directory URL.
  if (direct && (await fetchPage(direct))) return direct;
  for (const candidate of emailCandidates) {
    if (await fetchPage(candidate)) return candidate;
  }

  if (direct) return direct;

  const found = await findClinicWebsite(clinic);
  if (found) return found;

  if (emailDomain) return `https://${emailDomain}/`;
  return null;
}

// ---------------------------------------------------------------------------
// Logo candidate extraction
// ---------------------------------------------------------------------------

function parseAttrs(tag) {
  const attrs = {};
  const re = /([a-zA-Z0-9:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match;
  while ((match = re.exec(tag))) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attrs;
}

function firstSrc(attrs) {
  for (const key of [
    'data-breeze',
    'data-src',
    'data-lazy-src',
    'data-original',
    'data-lazy',
    'data-url',
    'data-image',
    'src',
  ]) {
    const value = attrs[key];
    if (value && !/^data:/i.test(value)) return value;
  }
  if (attrs.srcset) {
    const first = attrs.srcset.split(',')[0].trim().split(/\s+/)[0];
    if (first && !/^data:/i.test(first)) return first;
  }
  if (attrs['data-srcset']) {
    const first = attrs['data-srcset'].split(',')[0].trim().split(/\s+/)[0];
    if (first && !/^data:/i.test(first)) return first;
  }
  return null;
}

function findHeaderRange(html) {
  const header = html.search(/<header\b/i);
  if (header >= 0) {
    const end = html.indexOf('</header>', header);
    return { start: header, end: end > 0 ? end + 9 : header + 60000 };
  }
  const nav = html.search(/<nav\b/i);
  if (nav >= 0) {
    const end = html.indexOf('</nav>', nav);
    return { start: nav, end: end > 0 ? end + 6 : nav + 40000 };
  }
  const div = html.search(/<(?:div|section)[^>]+(?:id|class)=["'][^"']*header[^"']*["']/i);
  if (div >= 0) return { start: div, end: div + 60000 };
  return { start: 0, end: Math.min(html.length, 45000) };
}

function parseJsonLd(html, base) {
  const found = [];
  const scripts = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const script of scripts) {
    const json = script
      .replace(/^<script[^>]*>/i, '')
      .replace(/<\/script>$/i, '')
      .replace(/<!--|-->/g, '')
      .trim();
    let data;
    try {
      data = JSON.parse(json);
    } catch {
      continue;
    }
    const walk = (value) => {
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      if (!value || typeof value !== 'object') return;
      if (value.logo) {
        const logo =
          typeof value.logo === 'string'
            ? value.logo
            : value.logo.url || value.logo.contentUrl || value.logo['@id'];
        if (logo) found.push(resolveUrl(base, logo));
      }
      for (const [key, child] of Object.entries(value)) {
        if (key !== 'logo') walk(child);
      }
    };
    walk(data);
  }
  return found.filter(Boolean);
}

function extractCandidates(html, baseUrl, clinic) {
  const tokens = clinicTokens(clinic.clinic_brand_name || '');
  const badWords = BAD_WORDS.filter((word) => !String(clinic.clinic_brand_name || '').toLowerCase().includes(word));
  const badRe = badWords.length ? new RegExp(badWords.join('|'), 'i') : null;
  const headerRange = findHeaderRange(html);
  const candidates = [];

  for (const url of parseJsonLd(html, baseUrl)) {
    if (badRe && badRe.test(url.toLowerCase())) continue;
    if (/123dentist|dentalcorp/i.test(url)) continue;
    candidates.push({ url, score: 130, source: 'json-ld' });
  }

  let cursor = 0;
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  for (const tag of imgTags) {
    const position = html.indexOf(tag, cursor);
    cursor = position >= 0 ? position + tag.length : cursor;
    const attrs = parseAttrs(tag);
    const raw = firstSrc(attrs);
    if (!raw) continue;
    if (/spacer|pixel|blank|transparent\.gif|1x1/i.test(raw)) continue;
    const url = resolveUrl(baseUrl, raw);
    if (!url || !/^https?:/i.test(url)) continue;

    const width = Number(attrs.width || 0);
    const height = Number(attrs.height || 0);
    if ((width > 0 && width <= 2) || (height > 0 && height <= 2)) continue;

    const id = (attrs.id || '').toLowerCase();
    const cls = (attrs.class || '').toLowerCase();
    const alt = (attrs.alt || '').toLowerCase();
    const hay = `${url} ${alt} ${cls} ${id}`.toLowerCase();
    const inHeader = position >= headerRange.start && position <= headerRange.end;

    let score = 0;
    if (id === 'logo' || /(^|[-_])logo($|[-_])/.test(id)) score += 80;
    if (/logo|brand/.test(cls)) score += 50;
    if (/logo|brand/.test(alt)) score += 40;
    if (/[/_.-]logo(?:[/_.-]|$)|logo[/_.-]/i.test(url)) score += 40;
    const brandHay = normalizeName(clinic.clinic_brand_name);
    if (brandHay && (hay.includes(brandHay) || hay.includes(brandHay.replace(/\s+/g, '-')))) {
      score += 50;
    }
    if (tokens.some((token) => hay.includes(token))) score += 50;
    if (/oc-logos|assets\.123dentist\.com\/oc-logos/i.test(url)) score += 90;
    if (inHeader) score += 20;
    if (position >= 0 && position < 50000) score += 10;
    if (/\.svg(\?|$)/i.test(url)) score += 10;
    if (badRe && badRe.test(hay)) score -= 200;
    if (/\.(jpe?g)(\?|$)/i.test(url) && !/logo|brand/.test(hay)) score -= 40;
    if (/smile.*\.(jpe?g|webp)/i.test(hay) && !/logo|brand/.test(hay)) score -= 60;
    if (width > 0 && height > 0) {
      const ratio = width / height;
      if (ratio > 8 || ratio < 0.12) score -= 40;
    }

    candidates.push({ url, score, source: 'img' });
  }

  const linkTags = html.match(/<link\b[^>]*>/gi) || [];
  for (const tag of linkTags) {
    const attrs = parseAttrs(tag);
    const rel = (attrs.rel || '').toLowerCase();
    const href = attrs.href;
    if (!href) continue;
    const url = resolveUrl(baseUrl, href);
    if (!url) continue;
    if (rel.includes('apple-touch-icon')) candidates.push({ url, score: 55, source: 'apple-touch-icon' });
    else if (rel.split(/\s+/).includes('icon')) candidates.push({ url, score: 20, source: 'icon' });
  }

  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metaTags) {
    const attrs = parseAttrs(tag);
    const prop = (attrs.property || attrs.name || '').toLowerCase();
    if (prop !== 'og:image' && prop !== 'twitter:image') continue;
    if (!attrs.content) continue;
    const url = resolveUrl(baseUrl, attrs.content);
    if (!url) continue;
    const hay = `${url} ${attrs.content}`.toLowerCase();
    const hint = /logo|brand/.test(hay) || tokens.some((token) => hay.includes(token));
    candidates.push({ url, score: hint ? 30 : 5, source: prop });
  }

  const deduped = new Map();
  for (const candidate of candidates) {
    const previous = deduped.get(candidate.url);
    if (!previous || candidate.score > previous.score) deduped.set(candidate.url, candidate);
  }
  return [...deduped.values()].sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Image validation and optimization
// ---------------------------------------------------------------------------

async function inspectImage(buffer, sourceUrl, { trusted = false } = {}) {
  try {
    const pipeline = sharp(buffer, { density: 96, limitInputPixels: 40_000_000, animated: false });
    const meta = await pipeline.metadata();
    if (!meta.width || !meta.height) return null;
    if (meta.width < 32 || meta.height < 12) return null;
    if (meta.width > 8000 || meta.height > 8000) return null;
    const ratio = meta.width / meta.height;
    if (ratio > 12 || ratio < 0.08) return null;

    let stats = null;
    try {
      stats = await sharp(buffer, { density: 96, limitInputPixels: 40_000_000 })
        .resize({ width: 256, height: 256, fit: 'inside' })
        .stats();
    } catch {
      stats = null;
    }

    const hasAlpha = Boolean(meta.hasAlpha);
    const alphaMean = hasAlpha && stats?.channels?.[3] ? stats.channels[3].mean : null;
    const rgbChannels = stats?.channels?.slice(0, 3) || [];
    const rgbMean = rgbChannels.length
      ? rgbChannels.reduce((sum, channel) => sum + channel.mean, 0) / rgbChannels.length
      : 0;
    const entropy = stats?.entropy ?? 0;

    if (hasAlpha && alphaMean !== null && alphaMean < 3) return null;
    // White-on-transparent marks are real logos; ensureLegible() puts them on
    // a navy chip so they stay visible on the light email canvas.
    if (!trusted) {
      // Photographs have high entropy and usually no alpha channel. Real
      // logos sit well below this even when saved as JPEG.
      if (!hasAlpha && entropy > 6.2) return null;
      if (entropy > 7.3) return null;
      if (!hasAlpha && rgbMean > 252 && entropy < 1) return null;
    }

    return { meta, stats, entropy };
  } catch (error) {
    return null;
  }
}

async function ensureLegible(buffer) {
  // Sample a small copy; full-resolution raw reads are unnecessary and can
  // allocate hundreds of MB on large source images.
  const { data } = await sharp(buffer)
    .resize({ width: 256, height: 256, fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const meta = await sharp(buffer).metadata();
  if (!meta.hasAlpha) return buffer;

  let visible = 0;
  let sumLum = 0;
  let white = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    if (alpha < 0.1) continue;
    visible += 1;
    const r = data[i] * alpha + 255 * (1 - alpha);
    const g = data[i + 1] * alpha + 255 * (1 - alpha);
    const b = data[i + 2] * alpha + 255 * (1 - alpha);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sumLum += lum;
    if (lum > 240) white += 1;
  }
  if (!visible) return buffer;

  // Chip only logos whose dominant ink is near-white; white-on-transparent
  // marks are otherwise invisible on the #FAF9F6 email canvas.
  if (sumLum / visible <= 220 || white / visible <= 0.5) return buffer;

  const pad = Math.max(4, Math.round(Math.min(meta.width || 60, meta.height || 60) * 0.1));
  return sharp(buffer)
    .flatten({ background: '#172C46' })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#172C46' })
    .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
    .toBuffer();
}

async function optimizeLogo(buffer, { trim = true } = {}) {
  const meta = await sharp(buffer, { density: 96, limitInputPixels: 40_000_000 }).metadata();
  let base = buffer;

  if (trim && meta.format !== 'svg') {
    try {
      base = await sharp(buffer, { density: 96, limitInputPixels: 40_000_000 })
        .trim({ threshold: 12 })
        .toBuffer();
    } catch {
      base = buffer;
    }
  }

  // A fixed 48px render height clamps to the 50% header cell, which squashes
  // ultra-wide marks. Pad the canvas so the whole logo fits at that height.
  const trimmedMeta = await sharp(base).metadata();
  if (trimmedMeta.width > 0 && trimmedMeta.height > 0) {
    const minHeight = Math.ceil(trimmedMeta.width / 5.5);
    if (minHeight > trimmedMeta.height) {
      const extra = minHeight - trimmedMeta.height;
      const top = Math.floor(extra / 2);
      base = await sharp(base)
        .extend({
          top,
          bottom: extra - top,
          background: trimmedMeta.hasAlpha
            ? { r: 0, g: 0, b: 0, alpha: 0 }
            : { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .toBuffer();
    }
  }

  base = await ensureLegible(base);
  const baseMeta = await sharp(base).metadata();
  let pipeline = sharp(base, { density: 96, limitInputPixels: 40_000_000 });
  if (!baseMeta.hasAlpha) pipeline = pipeline.flatten({ background: '#ffffff' });

  let output = await pipeline
    .resize({ width: 180, height: 60, fit: 'inside', withoutEnlargement: false, kernel: 'lanczos3' })
    .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
    .toBuffer();

  const limit = 40 * 1024;
  if (output.length > limit) {
    for (const colors of [128, 64, 32]) {
      output = await sharp(output)
        .png({ compressionLevel: 9, palette: true, colors, quality: 80, effort: 10 })
        .toBuffer();
      if (output.length <= limit) break;
    }
  }
  if (output.length > limit) {
    const resized = await sharp(output).metadata();
    output = await sharp(output)
      .resize({
        width: Math.max(60, Math.round((resized.width || 180) * 0.8)),
        height: Math.max(24, Math.round((resized.height || 60) * 0.8)),
        fit: 'inside',
      })
      .png({ compressionLevel: 9, palette: true, colors: 64, quality: 80, effort: 10 })
      .toBuffer();
  }
  if (output.length > limit) {
    throw new Error(`optimized logo is ${output.length} bytes (>40 KB)`);
  }

  const finalMeta = await sharp(output).metadata();
  return {
    buffer: output,
    width: finalMeta.width,
    height: finalMeta.height,
    bytes: output.length,
  };
}

function initialsFor(name) {
  const words = String(name)
    .replace(/&/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !/^(dr|dr\.|the|and|of|at|dental|dentistry|dentaire|clinic|clinique|centre|center)$/i.test(word));
  const initials = words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  return initials || String(name).replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || 'VH';
}

function shortNameFor(name) {
  let out = String(name)
    .replace(/\b(dental|dentistry|dentaire|dentiste|dentistes|clinic|clinique|centre|center)\b/gi, '')
    .replace(/\b(dr|dr\.)\b/gi, ' ')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[,\s&-]+|[,\s&-]+$/g, '')
    .trim();
  if (out.length > 22) {
    out = out.slice(0, 22).replace(/[\s,&-]+\S*$/, '').trim();
  }
  return out;
}

async function makeBadge(name, { kind = 'monogram' } = {}) {
  const isDso = kind === 'dso';
  const label = isDso ? String(name).toUpperCase() : initialsFor(name);
  const sub = isDso ? 'DENTAL NETWORK' : shortNameFor(name) || 'DENTAL CLINIC';
  const svg = isDso
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120" viewBox="0 0 360 120">
        <rect x="2" y="2" width="356" height="116" rx="16" fill="#172C46"/>
        <text x="180" y="58" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="30" font-weight="700" fill="#FFFFFF">${escapeXml(label)}</text>
        <text x="180" y="84" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="12" letter-spacing="2" fill="#00AFA5">${escapeXml(sub)}</text>
      </svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120" viewBox="0 0 360 120">
        <rect x="2" y="2" width="356" height="116" rx="16" fill="#F4F8F7" stroke="#172C46" stroke-width="3"/>
        <circle cx="62" cy="60" r="34" fill="#172C46"/>
        <text x="62" y="73" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="700" fill="#FFFFFF">${escapeXml(label)}</text>
        <text x="112" y="55" font-family="Inter,Arial,sans-serif" font-size="${sub.length > 14 ? 16 : 20}" font-weight="700" fill="#172C46">${escapeXml(sub)}</text>
        <text x="112" y="81" font-family="Inter,Arial,sans-serif" font-size="12" letter-spacing="1.5" fill="#00AFA5">DENTAL CLINIC</text>
      </svg>`;

  const buffer = await sharp(Buffer.from(svg))
    .resize({ width: 180, height: 60, fit: 'fill' })
    .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
    .toBuffer();
  const meta = await sharp(buffer).metadata();
  return { buffer, width: meta.width, height: meta.height, bytes: buffer.length };
}

// ---------------------------------------------------------------------------
// Palette extraction
// ---------------------------------------------------------------------------

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function relativeLuminance({ r, g, b }) {
  const channel = (value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function darkenTo(rgb, targetLuminance) {
  let out = { ...rgb };
  for (let i = 0; i < 30 && relativeLuminance(out) > targetLuminance; i += 1) {
    out = { r: out.r * 0.9, g: out.g * 0.9, b: out.b * 0.9 };
  }
  return out;
}

function mixWithWhite(rgb, amount) {
  return {
    r: rgb.r + (255 - rgb.r) * amount,
    g: rgb.g + (255 - rgb.g) * amount,
    b: rgb.b + (255 - rgb.b) * amount,
  };
}

function colorDistance(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
}

async function extractPalette(buffer) {
  const fallback = {
    primary: '#172C46',
    secondary: '#56667A',
    accent: '#00AFA5',
    text: '#212121',
  };
  try {
    const { data, info } = await sharp(buffer)
      .resize({ width: 64, height: 64, fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 32) continue;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max > 240 && min > 225) continue;
      if (max < 30) continue;
      if (max - min < 20) continue;
      const key = `${r >> 4},${g >> 4},${b >> 4}`;
      const entry = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
      entry.count += 1;
      entry.r += r;
      entry.g += g;
      entry.b += b;
      buckets.set(key, entry);
    }

    const ranked = [...buckets.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((entry) => ({
        r: entry.r / entry.count,
        g: entry.g / entry.count,
        b: entry.b / entry.count,
        count: entry.count,
      }));

    if (!ranked.length) return fallback;

    const primary = ranked[0];
    const accent = ranked.find((color) => colorDistance(color, primary) > 50) || ranked[1] || primary;

    return {
      primary: rgbToHex(darkenTo(primary, 0.32)),
      secondary: rgbToHex(mixWithWhite(primary, 0.55)),
      accent: rgbToHex(darkenTo(accent, 0.45)),
      text: '#212121',
    };
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Curated overrides and DSO fallbacks
// ---------------------------------------------------------------------------

async function buildCuratedLogo(override) {
  if (!override) return null;

  if (Array.isArray(override.compose) && override.compose.length) {
    const parts = [];
    for (const item of override.compose) {
      const buffer = await fetchBuffer(item.url);
      if (!buffer) return null;
      const width = Number(item.width) || 280;
      let part;
      try {
        part = await sharp(buffer, { density: 96 })
          .trim({ threshold: 12 })
          .resize({ width, fit: 'inside', kernel: 'lanczos3' })
          .png()
          .toBuffer();
      } catch {
        return null;
      }
      const meta = await sharp(part).metadata();
      parts.push({ buffer: part, width: meta.width || width, height: meta.height || 40 });
    }

    const gap = Number(override.gap) || 6;
    const padding = 8;
    const canvasWidth = Number(override.canvasWidth) || 360;
    const canvasHeight =
      padding * 2 + parts.reduce((sum, part) => sum + part.height, 0) + gap * (parts.length - 1);
    const composites = [];
    let top = padding;
    for (const part of parts) {
      composites.push({
        input: part.buffer,
        left: Math.round((canvasWidth - part.width) / 2),
        top,
      });
      top += part.height + gap;
    }
    const composed = await sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      },
    })
      .composite(composites)
      .png()
      .toBuffer();

    const optimized = await optimizeLogo(composed, { trim: false });
    return {
      ...optimized,
      rawUrl: override.compose.map((item) => item.url).join(' | '),
      tier: 'CURATED',
      score: 999,
    };
  }

  if (override.url) {
    const buffer = await fetchBuffer(override.url);
    if (!buffer) return null;
    if (!(await inspectImage(buffer, override.url, { trusted: true }))) return null;
    const optimized = await optimizeLogo(buffer);
    return { ...optimized, rawUrl: override.url, tier: 'CURATED', score: 999 };
  }

  if (override.local) {
    const file = path.join(ROOT, override.local);
    if (!fs.existsSync(file)) return null;
    const buffer = fs.readFileSync(file);
    const optimized = await optimizeLogo(buffer);
    return { ...optimized, rawUrl: override.local, tier: 'CURATED', score: 999 };
  }

  return null;
}

function normalizeDso(value) {
  const lower = String(value || '').toLowerCase();
  if (lower.includes('123')) return '123dentist';
  if (lower.includes('dentalcorp')) return 'dentalcorp';
  return null;
}

const dsoCache = new Map();

function ensureDsoLogo(dso) {
  if (!dsoCache.has(dso)) dsoCache.set(dso, buildDsoLogo(dso));
  return dsoCache.get(dso);
}

async function buildDsoLogo(dso) {
  const file = path.join(ASSETS_DIR, `dso-${dso}.png`);

  // 123dentist.com is Cloudflare-protected and only exposes a low-resolution
  // favicon, so a generated wordmark is the stable, legible fallback.
  if (dso === '123dentist') {
    const badge = await makeBadge('123DENTIST', { kind: 'dso' });
    fs.writeFileSync(file, badge.buffer);
    return { ...badge, rawUrl: '', tier: 'DSO_FALLBACK', score: 100 };
  }

  if (fs.existsSync(file)) {
    const buffer = fs.readFileSync(file);
    try {
      const meta = await sharp(buffer).metadata();
      if (meta.format === 'png' && meta.width <= 180 && meta.height <= 60) {
        return {
          buffer,
          width: meta.width,
          height: meta.height,
          bytes: buffer.length,
          rawUrl: '',
          tier: 'DSO_FALLBACK',
          score: 200,
        };
      }
    } catch {
      /* regenerate below */
    }
  }

  let sourceUrl = '';
  let buffer = null;
  if (dso === 'dentalcorp') {
    sourceUrl = 'https://dentalcorp.ca/images/3737/2025/images/dentalcorp-logo.png';
    buffer = await fetchBuffer(sourceUrl);
  }

  if (buffer && (await inspectImage(buffer, sourceUrl, { trusted: true }))) {
    const optimized = await optimizeLogo(buffer);
    fs.writeFileSync(file, optimized.buffer);
    return {
      ...optimized,
      rawUrl: sourceUrl,
      tier: 'DSO_FALLBACK',
      score: 200,
    };
  }

  const badge = await makeBadge(dso === '123dentist' ? '123DENTIST' : 'dentalcorp', { kind: 'dso' });
  fs.writeFileSync(file, badge.buffer);
  return {
    ...badge,
    rawUrl: '',
    tier: 'DSO_FALLBACK',
    score: 100,
  };
}

// ---------------------------------------------------------------------------
// Main logo resolution
// ---------------------------------------------------------------------------

async function findLogo(clinic, domainUrl) {
  const override = overrides[clinic.clinic_brand_name];
  if (override) {
    const curated = await buildCuratedLogo(override);
    if (curated) {
      console.log(`  curated: ${curated.width}x${curated.height} ${curated.bytes}B`);
      return curated;
    }
    console.log('  curated override failed; falling through');
  }

  if (domainUrl) {
    const html = await fetchPage(domainUrl);
    if (html) {
      const candidates = extractCandidates(html, domainUrl, clinic);
      const plausible = candidates.filter((candidate) => candidate.score >= 45).slice(0, 12);
      if (plausible.length) {
        console.log(
          `  candidates: ${plausible
            .slice(0, 3)
            .map((candidate) => `${candidate.score}:${candidate.source}`)
            .join(', ')}`
        );
      }
      for (const candidate of plausible) {
        const buffer = await fetchBuffer(candidate.url, domainUrl);
        if (!buffer) continue;
        const inspected = await inspectImage(buffer, candidate.url);
        if (!inspected) continue;
        try {
          const optimized = await optimizeLogo(buffer);
          console.log(`  website: ${candidate.url} (score ${candidate.score})`);
          return {
            ...optimized,
            rawUrl: candidate.url,
            tier: 'WEBSITE_HEADER',
            score: candidate.score,
          };
        } catch (error) {
          console.log(`  optimize failed: ${error.message}`);
        }
      }
    } else {
      console.log('  website fetch blocked or empty; using fallback');
    }
  }

  const dso = normalizeDso(clinic.parent_dso);
  if (dso) {
    const dsoLogo = await ensureDsoLogo(dso);
    console.log(`  dso: ${dso} ${dsoLogo.width}x${dsoLogo.height}`);
    return dsoLogo;
  }

  const badge = await makeBadge(clinic.clinic_brand_name, { kind: 'monogram' });
  console.log(`  monogram: ${badge.width}x${badge.height}`);
  return { ...badge, rawUrl: '', tier: 'MONOGRAM_FALLBACK', score: 10 };
}

// ---------------------------------------------------------------------------
// Concurrency and main
// ---------------------------------------------------------------------------

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
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, run));
  return results;
}

function chooseColumns(rows) {
  const columns = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) columns.add(key);
  }
  for (const key of [
    'resolved_website_url',
    'clinic_logo_raw_url',
    'clinic_logo_hosted_url',
    'logo_source_tier',
    'logo_verified_status',
    'primary_color',
    'secondary_color',
    'accent_color',
    'text_color',
    'logo_width',
    'logo_height',
    'logo_bytes',
  ]) {
    columns.add(key);
  }
  return [...columns];
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Valioz Health — Lead Logo Enrichment Pipeline v2           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (!fs.existsSync(INPUT_CSV)) {
    throw new Error(`Input CSV not found: ${INPUT_CSV}`);
  }

  const records = parse(fs.readFileSync(INPUT_CSV, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
  console.log(`Loaded ${records.length} clinics from ${INPUT_CSV}\n`);

  const existing = fs.existsSync(OUTPUT_CSV)
    ? parse(fs.readFileSync(OUTPUT_CSV, 'utf8'), {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
      })
    : [];
  const existingByName = new Map(
    existing.map((row) => [normalizeName(row.clinic_brand_name), row])
  );

  let targets = records;
  if (args.only) {
    const wanted = String(args.only).split(',').map(normalizeName).filter(Boolean);
    targets = records.filter((row) =>
      wanted.some((name) => normalizeName(row.clinic_brand_name).includes(name))
    );
    if (!targets.length) throw new Error(`No clinics matched --only "${args.only}"`);
  }
  if (args.limit) targets = targets.slice(0, Number(args.limit));

  const concurrency = Number(args.concurrency) || 4;
  console.log(`Processing ${targets.length} clinic(s) with concurrency ${concurrency}\n`);

  const processed = await mapLimit(targets, concurrency, async (clinic) => {
    const name = clinic.clinic_brand_name || 'Unknown Clinic';
    const slug = slugify(name);
    console.log(`[${slug}] ${name}`);

    const domainUrl = await discoverDomain(clinic);
    if (domainUrl) console.log(`  website: ${domainUrl}`);

    const logo = await findLogo(clinic, domainUrl);
    const logoFile = path.join(ASSETS_DIR, `${slug}.png`);
    fs.writeFileSync(logoFile, logo.buffer);

    const palette = await extractPalette(logo.buffer);
    const status = ['WEBSITE_HEADER', 'CURATED'].includes(logo.tier) ? 'OK' : 'FALLBACK';

    console.log(
      `  → ${logo.tier} | ${logo.width}x${logo.height} | ${logo.bytes}B | ${palette.primary}/${palette.accent}`
    );

    return {
      ...clinic,
      resolved_website_url: domainUrl || '',
      clinic_logo_raw_url: logo.rawUrl || '',
      clinic_logo_hosted_url: `${HOSTED_BASE}/${slug}.png`,
      logo_source_tier: logo.tier,
      logo_verified_status: status,
      primary_color: palette.primary,
      secondary_color: palette.secondary,
      accent_color: palette.accent,
      text_color: palette.text,
      logo_width: logo.width,
      logo_height: logo.height,
      logo_bytes: logo.bytes,
    };
  });

  const processedByName = new Map(
    processed.map((row) => [normalizeName(row.clinic_brand_name), row])
  );
  const merged = records.map(
    (row) =>
      processedByName.get(normalizeName(row.clinic_brand_name)) ||
      existingByName.get(normalizeName(row.clinic_brand_name)) ||
      row
  );

  fs.writeFileSync(
    OUTPUT_CSV,
    stringifyCsv(merged, { header: true, columns: chooseColumns(merged) }),
    'utf8'
  );

  // A full run owns the asset directory: drop files from renamed/retired
  // clinics so the committed repo cannot serve orphaned logos.
  if (!args.only && !args.limit) {
    const keep = new Set(merged.map((row) => `${slugify(row.clinic_brand_name)}.png`));
    keep.add('dso-123dentist.png');
    keep.add('dso-dentalcorp.png');
    for (const file of fs.readdirSync(ASSETS_DIR)) {
      if (file.endsWith('.png') && !keep.has(file)) {
        fs.unlinkSync(path.join(ASSETS_DIR, file));
        console.log(`  pruned stale asset: ${file}`);
      }
    }
  }

  const tierCounts = processed.reduce((counts, row) => {
    counts[row.logo_source_tier] = (counts[row.logo_source_tier] || 0) + 1;
    return counts;
  }, {});

  console.log(`\n✅ Wrote ${merged.length} rows → ${OUTPUT_CSV}`);
  console.log('\n📊 Logo source tiers (this run):');
  for (const [tier, count] of Object.entries(tierCounts).sort()) {
    console.log(`   ${tier}: ${count}`);
  }
  console.log('\nNext: npm run build && npm test');
}

main().catch((error) => {
  console.error(`\n❌ ${error.stack || error.message}`);
  process.exit(1);
});
