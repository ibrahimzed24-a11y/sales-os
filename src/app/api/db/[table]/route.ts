import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { COOKIE_NAME, verifyToken } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ table: string }> };
type Body = Record<string, unknown>;
type Cfg = {
  model: string;
  uuid: boolean; // id column is uuid (accounts, contacts) or text
  readOnly?: boolean;
  fields: string[]; // writable columns (Prisma names)
  filters: Record<string, string>; // query param -> column
  sorts: string[];
  search: string[];
};

const CFG: Record<string, Cfg> = {
  accounts: {
    model: 'account', uuid: true,
    fields: ['name', 'domain', 'industry', 'size', 'annualRevenue', 'tier'],
    filters: { tier: 'tier', industry: 'industry', id: 'id' },
    sorts: ['createdAt', 'name', 'tier', 'industry', 'annualRevenue', 'size'],
    search: ['name', 'domain', 'industry'],
  },
  contacts: {
    model: 'contact', uuid: true,
    fields: ['accountId', 'firstName', 'lastName', 'email', 'phone', 'role', 'leadStatus', 'leadScore', 'source', 'tags', 'owner', 'lastContactedAt'],
    filters: { leadStatus: 'leadStatus', source: 'source', owner: 'owner', accountId: 'accountId', id: 'id' },
    sorts: ['createdAt', 'firstName', 'lastName', 'email', 'leadScore', 'leadStatus', 'source', 'owner'],
    search: ['firstName', 'lastName', 'email', 'phone', 'role'],
  },
  email_templates: {
    model: 'emailTemplate', uuid: false,
    fields: ['name', 'subject', 'body'],
    filters: { id: 'id' },
    sorts: ['createdAt', 'name'],
    search: ['name'],
  },
  campaigns: {
    model: 'campaign', uuid: false,
    fields: ['name', 'status', 'subject', 'templateId', 'audience', 'dailyLimit', 'notes'],
    filters: { status: 'status', id: 'id' },
    sorts: ['createdAt', 'name', 'status'],
    search: ['name'],
  },
  email_logs: {
    model: 'emailLog', uuid: false,
    fields: ['campaignId', 'contactId', 'toEmail', 'subject', 'body', 'status', 'error', 'gmailMessageId', 'preparedAt', 'sentAt'],
    filters: { campaignId: 'campaignId', status: 'status', contactId: 'contactId', id: 'id' },
    sorts: ['createdAt', 'status', 'toEmail'],
    search: ['toEmail', 'subject'],
  },
  import_jobs: {
    model: 'importJob', uuid: false, readOnly: true, fields: [],
    filters: { id: 'id', entity: 'entity' },
    sorts: ['createdAt'],
    search: [],
  },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATES = ['createdAt', 'preparedAt', 'sentAt', 'lastContactedAt'];
const NUMS = ['size', 'annualRevenue', 'leadScore', 'dailyLimit'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const M = (name: string) => (prisma as any)[name];

function signedIn(req: Request): boolean {
  const m = (req.headers.get('cookie') ?? '').match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  return !!m && !!verifyToken(m[1]);
}

function sessionOf(req: Request) {
  const m = (req.headers.get('cookie') ?? '').match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]+)'));
  return m ? verifyToken(m[1]) : null;
}

function fail(e: unknown, code: string) {
  const msg = e instanceof Error ? e.message.split('\n').filter(Boolean).pop() ?? '' : '';
  console.error(code, msg);
  return NextResponse.json({ error: code, detail: msg.slice(0, 200) }, { status: 502 });
}

async function guard(req: Request, ctx: Ctx, write: boolean): Promise<{ table: string; cfg: Cfg; uid: string } | NextResponse> {
  const sess = sessionOf(req);
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { table } = await ctx.params;
  const cfg = CFG[table];
  if (!cfg || (write && cfg.readOnly)) return NextResponse.json({ error: 'unknown_table' }, { status: 404 });
  return { table, cfg, uid: sess.userId };
}

// Returns null when a filter value can never match (so the caller answers with an empty list).
function buildWhere(table: string, cfg: Cfg, sp: URLSearchParams): Body | null {
  const and: Body[] = [];
  for (const [param, col] of Object.entries(cfg.filters)) {
    const v = sp.get(param);
    if (!v) continue;
    if ((col === 'id' || col === 'accountId') && cfg.uuid && !UUID.test(v)) return null;
    and.push({ [col]: v });
  }
  if (table === 'contacts') {
    const tag = sp.get('tag');
    if (tag) and.push({ tags: { has: tag } });
    if (sp.get('hasEmail') === '1') and.push({ email: { contains: '@' } });
  }
  const q = (sp.get('q') ?? '').trim().toLowerCase();
  if (q && cfg.search.length) {
    for (const tok of q.split(/\s+/).filter(Boolean)) {
      and.push({ OR: cfg.search.map((f) => ({ [f]: { contains: tok, mode: 'insensitive' } })) });
    }
  }
  return and.length ? { AND: and } : {};
}

function out(table: string, row: Body): Body {
  const o: Body = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'account') o.accountName = v && typeof v === 'object' ? (v as { name?: string }).name ?? '' : '';
    else if (k === '_count') o.contactCount = Number((v as { contacts?: number } | null)?.contacts ?? 0);
    else if (v !== null && typeof v === 'object' && typeof (v as { toNumber?: unknown }).toNumber === 'function') o[k] = (v as { toNumber: () => number }).toNumber();
    else o[k] = v === null && k.endsWith('Id') ? '' : v;
  }
  if (table === 'contacts' && !('accountName' in o)) o.accountName = '';
  return o;
}

function toData(cfg: Cfg, item: Body): Body {
  const d: Body = {};
  for (const f of [...cfg.fields, 'createdAt']) {
    if (!(f in item)) continue;
    let v = item[f];
    if ((f.endsWith('Id') || DATES.includes(f)) && (v === '' || v === undefined)) v = null;
    if (f === 'createdAt' && v === null) continue;
    if (DATES.includes(f) && typeof v === 'string') {
      const t = new Date(v);
      v = Number.isNaN(t.getTime()) ? null : t;
    }
    if (NUMS.includes(f) && v !== null && v !== undefined) v = Number(v) || 0;
    if (f === 'tags') v = Array.isArray(v) ? v.map(String) : [];
    d[f] = v;
  }
  return d;
}

export async function GET(req: Request, ctx: Ctx) {
  const g = await guard(req, ctx, false);
  if (g instanceof NextResponse) return g;
  const { table, cfg, uid } = g;
  try {
    const sp = new URL(req.url).searchParams;
    const all = sp.get('all') === '1';
    const pageSize = all ? 1000 : Math.min(200, Math.max(1, Number(sp.get('pageSize')) || 50));
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const where0 = buildWhere(table, cfg, sp);
    if (!where0) return NextResponse.json({ rows: [], total: 0, page, pageSize });
    const where = { AND: [where0, { ownerId: uid }] };
    const sortRaw = sp.get('sort') ?? '';
    const sort = cfg.sorts.includes(sortRaw) ? sortRaw : 'createdAt';
    const dir = sp.get('dir') === 'asc' ? 'asc' : 'desc';
    const include = table === 'contacts' ? { account: { select: { name: true } } } : table === 'accounts' ? { _count: { select: { contacts: true } } } : undefined;
    const [rows, total] = await Promise.all([
      M(cfg.model).findMany({ where, orderBy: [{ [sort]: dir }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize, ...(include ? { include } : {}) }),
      M(cfg.model).count({ where }),
    ]);
    return NextResponse.json({ rows: (rows as Body[]).map((r) => out(table, r)), total, page, pageSize });
  } catch (e) {
    return fail(e, 'db_read_failed');
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const g = await guard(req, ctx, true);
  if (g instanceof NextResponse) return g;
  const { table, cfg, uid } = g;
  const body = (await req.json().catch(() => null)) as { items?: Body[]; item?: Body } | null;
  const items = body?.items ?? (body?.item ? [body.item] : []);
  if (items.length === 0 || items.length > 2000) return NextResponse.json({ error: 'invalid_items' }, { status: 400 });
  for (const i of items) {
    const needsName = table === 'accounts' || table === 'campaigns' || table === 'email_templates';
    const badId = typeof i.id !== 'string' || !i.id || (cfg.uuid && !UUID.test(i.id));
    const badName = needsName && !String(i.name ?? '').trim();
    const badContact = table === 'contacts' && !String(i.firstName ?? '').trim() && !String(i.lastName ?? '').trim();
    if (badId || badName || badContact) return NextResponse.json({ error: 'invalid_item' }, { status: 400 });
  }
  try {
    const ids = items.map((i) => i.id as string);
    const clash = await M(cfg.model).findMany({ where: { id: { in: ids }, OR: [{ ownerId: null }, { ownerId: { not: uid } }] }, select: { id: true } });
    if (clash.length) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    if (table === 'contacts') {
      const aids = Array.from(new Set(items.map((i) => i.accountId).filter((a): a is string => typeof a === 'string' && a !== '')));
      if (aids.length && (aids.some((a) => !UUID.test(a)) || (await prisma.account.count({ where: { id: { in: aids }, ownerId: uid } })) !== aids.length)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const ignore = new URL(req.url).searchParams.get('ignore') === '1';
    for (let n = 0; n < items.length; n += 100) {
      const chunk = items.slice(n, n + 100);
      if (ignore) {
        await M(cfg.model).createMany({ data: chunk.map((i) => ({ id: i.id, ...toData(cfg, i), ownerId: uid })), skipDuplicates: true });
      } else {
        await prisma.$transaction(
          chunk.map((i) => M(cfg.model).upsert({ where: { id: i.id }, create: { id: i.id, ...toData(cfg, i), ownerId: uid }, update: { ...toData(cfg, i), updatedAt: new Date() } })),
        );
      }
    }
    return NextResponse.json({ saved: items.length });
  } catch (e) {
    return fail(e, 'db_write_failed');
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const g = await guard(req, ctx, true);
  if (g instanceof NextResponse) return g;
  const { table, cfg, uid } = g;
  const body = (await req.json().catch(() => null)) as { ids?: string[]; all?: boolean; filters?: Record<string, string>; patch?: Body } | null;
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  const data = toData(cfg, body.patch ?? {});
  delete data.createdAt;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'empty_patch' }, { status: 400 });
  if (table === 'contacts' && typeof data.accountId === 'string' && (!UUID.test(data.accountId) || (await prisma.account.count({ where: { id: data.accountId, ownerId: uid } })) === 0)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    let where: Body | null;
    if (body.all) where = buildWhere(table, cfg, new URLSearchParams(body.filters ?? {}));
    else where = { id: { in: (body.ids ?? []).filter((x) => typeof x === 'string' && (!cfg.uuid || UUID.test(x))) } };
    if (!where) return NextResponse.json({ ok: true, updated: 0 });
    where = { AND: [where, { ownerId: uid }] };
    const r = await M(cfg.model).updateMany({ where, data: { ...data, updatedAt: new Date() } });
    return NextResponse.json({ ok: true, updated: r.count });
  } catch (e) {
    return fail(e, 'db_write_failed');
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const g = await guard(req, ctx, true);
  if (g instanceof NextResponse) return g;
  const { cfg, uid } = g;
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!id || (cfg.uuid && !UUID.test(id))) return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  try {
    await M(cfg.model).deleteMany({ where: { id, ownerId: uid } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e, 'db_write_failed');
  }
}
