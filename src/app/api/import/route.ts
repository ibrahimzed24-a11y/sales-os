import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth-utils';
import type { LeadSource, LeadStatus } from '@/types/sales-os';

export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'sales-os-session';

function getSession(req: Request): { userId: string; email: string; role: string } | null {
  const cookie = req.headers.get('cookie') ?? '';
  const match = cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  return verifyToken(match[1]);
}

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;
const STATUSES = ['New', 'Contacted', 'Working', 'Qualified', 'Unqualified'];
const SOURCES = ['Inbound', 'Outbound', 'Referral', 'Partner'];
const TIERS = ['Enterprise', 'Mid-Market', 'SMB'];
const uid = (p: string) => p + '_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
const pick = (list: string[], v: string | undefined, d: string) => list.find((x) => x.toLowerCase() === (v ?? '').trim().toLowerCase()) ?? d;
const numOf = (v: string | undefined) => Number((v ?? '').replace(/[^0-9.-]/g, '')) || 0;

async function auth(req: Request) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return session;
}

async function importContacts(rows: Record<string, string>[], userId: string) {
  const skipped: { row: number; reason: string; value: string }[] = [];
  const skip = (r: Record<string, string>, reason: string, value = '') => skipped.push({ row: Number(r.row), reason, value });
  const good: { r: Record<string, string>; email: string; key: string }[] = [];
  const seen = new Set<string>();
  const now = new Date().toISOString();

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

  // Check duplicates in DB
  const emailsWithDb = good.filter((x) => x.email).map((x) => x.email);
  const existingEmails = emailsWithDb.length > 0
    ? await prisma.contact.findMany({ where: { email: { in: emailsWithDb } }, select: { email: true } })
    : [];
  const haveEmail = new Set(existingEmails.map((x) => x.email!));

  const fresh = good.filter((x) => {
    if (x.email && haveEmail.has(x.email)) { skip(x.r, 'Already exists', x.key); return false; }
    return true;
  });

  // Create accounts for new companies
  const names = new Map<string, string>();
  for (const x of fresh) {
    const n = (x.r.company ?? '').trim();
    if (n) names.set(n.toLowerCase(), n);
  }

  const existingAccounts = names.size > 0
    ? await prisma.account.findMany({ where: { name: { in: Array.from(names.keys()) } }, select: { id: true, name: true } })
    : [];
  const accId = new Map<string, string>();
  for (const a of existingAccounts) accId.set(a.name.toLowerCase(), a.id);

  const toCreate = Array.from(names.entries()).filter(([k]) => !accId.has(k));
  for (const [key, name] of toCreate) {
    const acc = await prisma.account.create({
      data: { id: uid('acc'), name, userId },
    });
    accId.set(key, acc.id);
  }

  const recs = fresh.map((x) => ({
    id: uid('con'),
    accountId: accId.get((x.r.company ?? '').trim().toLowerCase()) ?? null,
    userId,
    firstName: (x.r.firstName ?? '').trim(),
    lastName: (x.r.lastName ?? '').trim(),
    email: x.email || null,
    phone: (x.r.phone ?? '').trim() || null,
    role: (x.r.role ?? '').trim() || null,
    leadStatus: pick(STATUSES, x.r.leadStatus, 'New') as unknown as LeadStatus,
    leadScore: Math.min(100, Math.max(0, Math.round(numOf(x.r.leadScore)) || 50)),
    source: pick(SOURCES, x.r.source, 'Inbound') as unknown as LeadSource,
    tags: (x.r.tags ?? '').split(/[;|,]/).map((t) => t.trim()).filter(Boolean),
    owner: (x.r.owner ?? '').trim(),
    createdAt: now,
  }));

  // Create in batches
  let imported = 0;
  for (let i = 0; i < recs.length; i += 200) {
    const chunk = recs.slice(i, i + 200);
    const correspondingFresh = fresh.slice(i, i + 200);
    try {
      await prisma.contact.createMany({ data: chunk });
      imported += chunk.length;
    } catch {
      for (const r of correspondingFresh) skipped.push({ row: Number(r.r.row), reason: 'Database error', value: r.r.name || r.key });
    }
  }

  return { imported, skipped, accountsCreated: toCreate.length, linked: recs.filter((x) => x.accountId).length };
}

async function importAccounts(rows: Record<string, string>[], userId: string) {
  const skipped: { row: number; reason: string; value: string }[] = [];
  const skip = (r: Record<string, string>, reason: string, value = '') => skipped.push({ row: Number(r.row), reason, value });
  const good: { r: Record<string, string>; key: string; domain: string }[] = [];
  const seenName = new Set<string>();
  const seenDomain = new Set<string>();
  const now = new Date().toISOString();

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

  // Check duplicates in DB
  const namesWithDb = good.map((x) => x.key);
  const existingNames = await prisma.account.findMany({ where: { name: { in: namesWithDb } }, select: { name: true } });
  const haveName = new Set(existingNames.map((x) => x.name.toLowerCase()));

  const domainsWithDb = good.filter((x) => x.domain).map((x) => x.domain);
  const existingDomains = domainsWithDb.length > 0
    ? await prisma.account.findMany({ where: { domain: { in: domainsWithDb } }, select: { domain: true } })
    : [];
  const haveDomain = new Set(existingDomains.map((x) => x.domain!.toLowerCase()));

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
          id: uid('acc'),
          userId,
          name: x.r.name.trim(),
          domain: x.domain || null,
          industry: (x.r.industry ?? '').trim() || null,
          size: Math.round(numOf(x.r.size)),
          annualRevenue: numOf(x.r.annualRevenue),
          tier: pick(TIERS, x.r.tier, 'SMB') as any,
          createdAt: now,
        })),
      });
      imported += chunk.length;
    } catch {
      for (const x of chunk) skipped.push({ row: Number(x.r.row), reason: 'Database error', value: x.r.name });
    }
  }

  return { imported, skipped, accountsCreated: 0, linked: 0 };
}

export async function POST(req: Request) {
  const session = await auth(req);
  if (session instanceof NextResponse) return session;
  const userId = session.userId;

  const body = (await req.json().catch(() => null)) as
    | { kind?: string; entity?: string; rows?: Record<string, string>[]; fileName?: string; total?: number; imported?: number; skipped?: number; report?: unknown }
    | null;
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  if (body.kind === 'job') {
    await prisma.importJob.create({
      data: {
        id: uid('imp'),
        userId,
        entity: body.entity ?? '',
        fileName: body.fileName ?? null,
        total: body.total ?? 0,
        imported: body.imported ?? 0,
        skipped: body.skipped ?? 0,
        report: body.report ?? {},
      },
    }).catch(() => undefined);
    return NextResponse.json({ saved: true });
  }

  if (!Array.isArray(body.rows) || body.rows.length > 300) return NextResponse.json({ error: 'invalid_rows' }, { status: 400 });

  if (body.entity === 'contacts') return NextResponse.json(await importContacts(body.rows, userId));
  if (body.entity === 'accounts') return NextResponse.json(await importAccounts(body.rows, userId));
  return NextResponse.json({ error: 'invalid_entity' }, { status: 400 });
}
