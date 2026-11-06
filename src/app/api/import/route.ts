import { NextResponse } from 'next/server';
import { check, sb } from '@/lib/server';

export const dynamic = 'force-dynamic';

type Row = Record<string, string> & { row: number };
type Skip = { row: number; reason: string; value: string };

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;
const STATUSES = ['New', 'Contacted', 'Working', 'Qualified', 'Unqualified'];
const SOURCES = ['Inbound', 'Outbound', 'Referral', 'Partner'];
const TIERS = ['Enterprise', 'Mid-Market', 'SMB'];
const uid = (p: string) => p + '_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
const pick = (list: string[], v: string | undefined, d: string) => list.find((x) => x.toLowerCase() === (v ?? '').trim().toLowerCase()) ?? d;
const quote = (v: string) => '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
const numOf = (v: string | undefined) => Number((v ?? '').replace(/[^0-9.-]/g, '')) || 0;
const DUP_FILE = 'Duplicate inside file / مكرر داخل الملف';
const DUP_DB = 'Already exists in database / موجود بالفعل';

async function lookup(table: string, select: string, col: string, values: string[]) {
  const found: Record<string, string>[] = [];
  for (let i = 0; i < values.length; i += 80) {
    const f = encodeURIComponent('in.(' + values.slice(i, i + 80).map(quote).join(',') + ')');
    const r = await sb(table + '?select=' + select + '&' + col + '=' + f);
    if (r.ok) found.push(...((await r.json()) as Record<string, string>[]));
  }
  return found;
}

async function insertAll(table: string, recs: Record<string, unknown>[]) {
  let ok = 0;
  const failed: number[] = [];
  for (let i = 0; i < recs.length; i += 200) {
    const chunk = recs.slice(i, i + 200);
    const r = await sb(table, { method: 'POST', body: JSON.stringify(chunk) }, 'return=minimal');
    if (r.ok) ok += chunk.length;
    else for (let j = i; j < i + chunk.length; j++) failed.push(j);
  }
  return { ok, failed };
}

async function importContacts(rows: Row[]) {
  const skipped: Skip[] = [];
  const skip = (r: Row, reason: string, value = '') => skipped.push({ row: r.row, reason, value });
  const good: { r: Row; email: string; key: string }[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const email = (r.email ?? '').trim().toLowerCase();
    const digits = (r.phone ?? '').replace(/\D/g, '');
    if (email && !EMAIL.test(email)) { skip(r, 'Invalid email / بريد غير صالح', email); continue; }
    if (!email && digits.length < 7) { skip(r, 'No email or phone / لا يوجد بريد أو هاتف'); continue; }
    if (!email && !(r.firstName || r.lastName)) { skip(r, 'No name / لا يوجد اسم'); continue; }
    const key = email || 'p:' + digits;
    if (seen.has(key)) { skip(r, DUP_FILE, key); continue; }
    seen.add(key);
    good.push({ r, email, key });
  }
  const haveEmail = new Set((await lookup('contacts', 'email_key', 'email_key', good.filter((x) => x.email).map((x) => x.email))).map((x) => x.email_key));
  const havePhone = new Set((await lookup('contacts', 'phone', 'phone', good.filter((x) => !x.email).map((x) => (x.r.phone ?? '').trim()))).map((x) => x.phone));
  const fresh = good.filter((x) => {
    const dup = x.email ? haveEmail.has(x.email) : havePhone.has((x.r.phone ?? '').trim());
    if (dup) skip(x.r, DUP_DB, x.key);
    return !dup;
  });
  const names = new Map<string, string>();
  for (const x of fresh) { const n = (x.r.company ?? '').trim(); if (n) names.set(n.toLowerCase(), n); }
  const accId = new Map<string, string>();
  for (const a of await lookup('accounts', 'id,name_key', 'name_key', Array.from(names.keys()))) accId.set(a.name_key, a.id);
  const create = Array.from(names.entries()).filter((e) => !accId.has(e[0])).map((e) => ({ id: uid('acc'), name: e[1], key: e[0] }));
  const made = create.length ? await insertAll('accounts', create.map((c) => ({ id: c.id, name: c.name }))) : { ok: 0, failed: [] as number[] };
  if (made.failed.length === 0) create.forEach((c) => accId.set(c.key, c.id));
  const now = new Date().toISOString();
  const recs = fresh.map((x) => ({
    id: uid('con'),
    account_id: accId.get((x.r.company ?? '').trim().toLowerCase()) ?? null,
    first_name: (x.r.firstName ?? '').trim(),
    last_name: (x.r.lastName ?? '').trim(),
    email: x.email,
    phone: (x.r.phone ?? '').trim(),
    role: (x.r.role ?? '').trim(),
    lead_status: pick(STATUSES, x.r.leadStatus, 'New'),
    lead_score: Math.min(100, Math.max(0, Math.round(numOf(x.r.leadScore)) || 50)),
    source: pick(SOURCES, x.r.source, 'Inbound'),
    tags: (x.r.tags ?? '').split(/[;|,]/).map((t) => t.trim()).filter(Boolean),
    owner: (x.r.owner ?? '').trim(),
    created_at: now,
  }));
  const res = await insertAll('contacts', recs);
  res.failed.forEach((i) => skip(fresh[i].r, 'Database error / خطأ في قاعدة البيانات', fresh[i].key));
  return { imported: res.ok, skipped, accountsCreated: made.failed.length ? 0 : create.length, linked: recs.filter((x) => x.account_id).length };
}

const domainOf = (v: string) => v.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

async function importAccounts(rows: Row[]) {
  const skipped: Skip[] = [];
  const skip = (r: Row, reason: string, value = '') => skipped.push({ row: r.row, reason, value });
  const good: { r: Row; key: string; domain: string }[] = [];
  const seenName = new Set<string>();
  const seenDomain = new Set<string>();
  for (const r of rows) {
    const name = (r.name ?? '').trim();
    const domain = domainOf(r.domain ?? '');
    if (!name) { skip(r, 'Missing company name / اسم الشركة مفقود'); continue; }
    const key = name.toLowerCase();
    if (seenName.has(key) || (domain && seenDomain.has(domain))) { skip(r, DUP_FILE, name); continue; }
    seenName.add(key);
    if (domain) seenDomain.add(domain);
    good.push({ r, key, domain });
  }
  const haveName = new Set((await lookup('accounts', 'name_key', 'name_key', good.map((x) => x.key))).map((x) => x.name_key));
  const haveDomain = new Set((await lookup('accounts', 'domain', 'domain', good.filter((x) => x.domain).map((x) => x.domain))).map((x) => x.domain));
  const fresh = good.filter((x) => {
    const dup = haveName.has(x.key) || (x.domain !== '' && haveDomain.has(x.domain));
    if (dup) skip(x.r, DUP_DB, x.r.name);
    return !dup;
  });
  const now = new Date().toISOString();
  const res = await insertAll('accounts', fresh.map((x) => ({
    id: uid('acc'),
    name: x.r.name.trim(),
    domain: x.domain,
    industry: (x.r.industry ?? '').trim(),
    size: Math.round(numOf(x.r.size)),
    annual_revenue: numOf(x.r.annualRevenue),
    tier: pick(TIERS, x.r.tier, 'SMB'),
    created_at: now,
  })));
  res.failed.forEach((i) => skip(fresh[i].r, 'Database error / خطأ في قاعدة البيانات', fresh[i].r.name));
  return { imported: res.ok, skipped, accountsCreated: 0, linked: 0 };
}

export async function POST(req: Request) {
  const bad = check(req);
  if (bad) return NextResponse.json(await bad.json(), { status: bad.status });
  const body = (await req.json().catch(() => null)) as
    | { kind?: string; entity?: string; rows?: Row[]; fileName?: string; total?: number; imported?: number; skipped?: number; report?: unknown }
    | null;
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  if (body.kind === 'job') {
    const r = await sb('import_jobs', {
      method: 'POST',
      body: JSON.stringify({ id: uid('imp'), entity: body.entity ?? '', file_name: body.fileName ?? '', total: body.total ?? 0, imported: body.imported ?? 0, skipped: body.skipped ?? 0, report: body.report ?? {} }),
    }, 'return=minimal');
    return NextResponse.json({ saved: r.ok });
  }
  if (!Array.isArray(body.rows) || body.rows.length > 300) return NextResponse.json({ error: 'invalid_rows' }, { status: 400 });
  if (body.entity === 'contacts') return NextResponse.json(await importContacts(body.rows));
  if (body.entity === 'accounts') return NextResponse.json(await importAccounts(body.rows));
  return NextResponse.json({ error: 'invalid_entity' }, { status: 400 });
}
