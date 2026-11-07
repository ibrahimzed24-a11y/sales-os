import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { COOKIE_NAME, verifyToken } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

type Row = Record<string, string>;
type Skip = { row: number; reason: string; value: string };

function signedIn(req: Request): boolean {
  const m = (req.headers.get('cookie') ?? '').match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  return !!m && !!verifyToken(m[1]);
}

function uidOf(req: Request): string | null {
  const m = (req.headers.get('cookie') ?? '').match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]+)'));
  const p = m ? verifyToken(m[1]) : null;
  return p ? p.userId : null;
}

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;
const STATUSES = ['New', 'Contacted', 'Working', 'Qualified', 'Unqualified'];
const SOURCES = ['Inbound', 'Outbound', 'Referral', 'Partner'];
const TIERS = ['Enterprise', 'Mid-Market', 'SMB'];
const pick = (list: string[], v: string | undefined, d: string) => list.find((x) => x.toLowerCase() === (v ?? '').trim().toLowerCase()) ?? d;
const numOf = (v: string | undefined) => Number((v ?? '').replace(/[^0-9.-]/g, '')) || 0;

async function importContacts(rows: Row[], uid: string) {
  const skipped: Skip[] = [];
  const skip = (r: Row, reason: string, value = '') => skipped.push({ row: Number(r.row), reason, value });
  const good: { r: Row; email: string; key: string }[] = [];
  const seen = new Set<string>();

  for (const r of rows) {
    const email = (r.email ?? '').trim().toLowerCase();
    const digits = (r.phone ?? '').replace(/\D/g, '');
    if (email && !EMAIL.test(email)) { skip(r, 'Invalid email', email); continue; }
    if (!email && digits.length < 7) { skip(r, 'No email or phone'); continue; }
    if (!email && !(r.firstName || r.lastName)) { skip(r, 'No name'); continue; }
    const key = email || 'p:' + digits;
    if (seen.has(key)) { skip(r, 'Duplicate inside file', key); continue; }
    seen.add(key);
    good.push({ r, email, key });
  }

  const emails = good.filter((x) => x.email).map((x) => x.email);
  const existing = emails.length ? await prisma.contact.findMany({ where: { ownerId: uid, email: { in: emails, mode: 'insensitive' } }, select: { email: true } }) : [];
  const haveEmail = new Set(existing.map((x) => (x.email ?? '').toLowerCase()));
  const fresh = good.filter((x) => {
    if (x.email && haveEmail.has(x.email)) { skip(x.r, 'Already exists', x.key); return false; }
    return true;
  });

  const names = new Map<string, string>();
  for (const x of fresh) {
    const n = (x.r.company ?? '').trim();
    if (n) names.set(n.toLowerCase(), n);
  }
  const accId = new Map<string, string>();
  if (names.size) {
    const found = await prisma.account.findMany({
      where: { ownerId: uid, OR: Array.from(names.values()).map((n) => ({ name: { equals: n, mode: 'insensitive' as const } })) },
      select: { id: true, name: true },
    });
    for (const a of found) accId.set(a.name.toLowerCase(), a.id);
  }
  const toCreate = Array.from(names.entries()).filter(([k]) => !accId.has(k));
  if (toCreate.length) {
    const made = toCreate.map(([k, name]) => ({ k, id: randomUUID(), name }));
    await prisma.account.createMany({ data: made.map((m) => ({ id: m.id, ownerId: uid, name: m.name })) });
    for (const m of made) accId.set(m.k, m.id);
  }

  const recs = fresh.map((x) => ({
    id: randomUUID(),
    ownerId: uid,
    accountId: accId.get((x.r.company ?? '').trim().toLowerCase()) ?? null,
    firstName: (x.r.firstName ?? '').trim(),
    lastName: (x.r.lastName ?? '').trim(),
    email: x.email || null,
    phone: (x.r.phone ?? '').trim() || null,
    role: (x.r.role ?? '').trim() || null,
    leadStatus: pick(STATUSES, x.r.leadStatus, 'New'),
    leadScore: Math.min(100, Math.max(0, Math.round(numOf(x.r.leadScore)) || 50)),
    source: pick(SOURCES, x.r.source, 'Inbound'),
    tags: (x.r.tags ?? '').split(/[;|,]/).map((t) => t.trim()).filter(Boolean),
    owner: (x.r.owner ?? '').trim(),
  }));

  let imported = 0;
  for (let i = 0; i < recs.length; i += 200) {
    const chunk = recs.slice(i, i + 200);
    try {
      await prisma.contact.createMany({ data: chunk });
      imported += chunk.length;
    } catch {
      for (const r of fresh.slice(i, i + 200)) skip(r.r, 'Database error', r.key);
    }
  }
  return { imported, skipped, accountsCreated: toCreate.length, linked: recs.filter((x) => x.accountId).length };
}

async function importAccounts(rows: Row[], uid: string) {
  const skipped: Skip[] = [];
  const skip = (r: Row, reason: string, value = '') => skipped.push({ row: Number(r.row), reason, value });
  const good: { r: Row; key: string; domain: string }[] = [];
  const seenName = new Set<string>();
  const seenDomain = new Set<string>();

  for (const r of rows) {
    const name = (r.name ?? '').trim();
    const domain = (r.domain ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (!name) { skip(r, 'Missing company name'); continue; }
    const key = name.toLowerCase();
    if (seenName.has(key) || (domain && seenDomain.has(domain))) { skip(r, 'Duplicate inside file', name); continue; }
    seenName.add(key);
    if (domain) seenDomain.add(domain);
    good.push({ r, key, domain });
  }

  const found = good.length
    ? await prisma.account.findMany({
        where: { ownerId: uid, OR: [
          ...good.map((x) => ({ name: { equals: x.r.name.trim(), mode: 'insensitive' as const } })),
          ...good.filter((x) => x.domain).map((x) => ({ domain: { equals: x.domain, mode: 'insensitive' as const } })),
        ] },
        select: { name: true, domain: true },
      })
    : [];
  const haveName = new Set(found.map((x) => x.name.toLowerCase()));
  const haveDomain = new Set(found.map((x) => (x.domain ?? '').toLowerCase()).filter(Boolean));
  const fresh = good.filter((x) => {
    const dup = haveName.has(x.key) || (x.domain !== '' && haveDomain.has(x.domain));
    if (dup) skip(x.r, 'Already exists', x.r.name);
    return !dup;
  });

  let imported = 0;
  for (let i = 0; i < fresh.length; i += 200) {
    const chunk = fresh.slice(i, i + 200);
    try {
      await prisma.account.createMany({
        data: chunk.map((x) => ({
          id: randomUUID(),
          ownerId: uid,
          name: x.r.name.trim(),
          domain: x.domain || null,
          industry: (x.r.industry ?? '').trim() || null,
          size: Math.round(numOf(x.r.size)),
          annualRevenue: numOf(x.r.annualRevenue),
          tier: pick(TIERS, x.r.tier, 'SMB'),
        })),
      });
      imported += chunk.length;
    } catch {
      for (const x of chunk) skip(x.r, 'Database error', x.r.name);
    }
  }
  return { imported, skipped, accountsCreated: 0, linked: 0 };
}

export async function POST(req: Request) {
  const uid = uidOf(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as
    | { kind?: string; entity?: string; rows?: Row[]; fileName?: string; total?: number; imported?: number; skipped?: number; report?: unknown }
    | null;
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  try {
    if (body.kind === 'job') {
      await prisma.importJob.create({
        data: {
          ownerId: uid,
          id: 'imp_' + randomUUID().replace(/-/g, '').slice(0, 14),
          entity: body.entity ?? '',
          fileName: body.fileName ?? null,
          total: body.total ?? 0,
          imported: body.imported ?? 0,
          skipped: body.skipped ?? 0,
          report: (body.report ?? {}) as object,
        },
      });
      return NextResponse.json({ saved: true });
    }
    if (!Array.isArray(body.rows) || body.rows.length > 300) return NextResponse.json({ error: 'invalid_rows' }, { status: 400 });
    if (body.entity === 'contacts') return NextResponse.json(await importContacts(body.rows, uid));
    if (body.entity === 'accounts') return NextResponse.json(await importAccounts(body.rows, uid));
    return NextResponse.json({ error: 'invalid_entity' }, { status: 400 });
  } catch (e) {
    console.error('import_failed', e instanceof Error ? e.message.split('\n').pop() : e);
    return NextResponse.json({ error: 'db_write_failed' }, { status: 502 });
  }
}
