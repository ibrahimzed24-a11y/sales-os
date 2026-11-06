import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth-utils';
import {
  validateAccount,
  validateContact,
  validateDeal,
  validateActivity,
  validateProduct,
  validateQuote,
  validatePlaybookItem,
} from '@/lib/validation';

export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'sales-os-session';

function getSession(req: Request): { userId: string; email: string; role: string } | null {
  const cookie = req.headers.get('cookie') ?? '';
  const match = cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  return verifyToken(match[1]);
}

// Map table name to Prisma model and its id field
const MODEL_MAP: Record<string, { model: string; idField: string }> = {
  accounts: { model: 'account', idField: 'id' },
  contacts: { model: 'contact', idField: 'id' },
  deals: { model: 'deal', idField: 'id' },
  activities: { model: 'activity', idField: 'id' },
  products: { model: 'product', idField: 'id' },
  quotes: { model: 'quote', idField: 'id' },
  playbooks: { model: 'playbookItem', idField: 'id' },
};

const VALIDATORS: Record<string, (data: unknown) => { success: boolean; data?: unknown; error?: unknown }> = {
  accounts: (d) => validateAccount(d),
  contacts: (d) => validateContact(d),
  deals: (d) => validateDeal(d),
  activities: (d) => validateActivity(d),
  products: (d) => validateProduct(d),
  quotes: (d) => validateQuote(d),
  playbooks: (d) => validatePlaybookItem(d),
};

async function auth(req: Request) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return session;
}

export async function GET(req: Request, ctx: { params: Promise<{ table: string }> }) {
  const session = await auth(req);
  if (session instanceof NextResponse) return session;
  const { table } = await ctx.params;
  const modelInfo = MODEL_MAP[table];
  if (!modelInfo) return NextResponse.json({ error: 'unknown_table' }, { status: 404 });

  const url = new URL(req.url);
  const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get('pageSize')) || 50));
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const where: Record<string, unknown> = {};

  // Simple filters
  const filterParam = url.searchParams.get('filter');
  if (filterParam) {
    try {
      const f = JSON.parse(filterParam);
      Object.assign(where, f);
    } catch {
      /* ignore invalid filter */
    }
  }

  // Search
  const q = (url.searchParams.get('q') ?? '').trim();
  if (q && (table === 'contacts' || table === 'accounts')) {
    where.OR = [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
  }

  const sort = url.searchParams.get('sort') || 'createdAt';
  const dir = (url.searchParams.get('dir') || 'desc') as 'asc' | 'desc';

  const [rows, total] = await Promise.all([
    (prisma as any)[modelInfo.model].findMany({
      where,
      orderBy: { [sort]: dir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    (prisma as any)[modelInfo.model].count({ where }),
  ]);

  return NextResponse.json({ rows, total, page, pageSize });
}

export async function POST(req: Request, ctx: { params: Promise<{ table: string }> }) {
  const session = await auth(req);
  if (session instanceof NextResponse) return session;
  const { table } = await ctx.params;
  const modelInfo = MODEL_MAP[table];
  if (!modelInfo) return NextResponse.json({ error: 'unknown_table' }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { items?: unknown[]; item?: unknown } | null;
  const items = body?.items ?? (body?.item ? [body.item] : []);
  if (items.length === 0 || items.length > 2000) return NextResponse.json({ error: 'invalid_items' }, { status: 400 });

  // Validate each item
  const validator = VALIDATORS[table];
  if (validator) {
    const errors: { index: number; message: string }[] = [];
    items.forEach((item, index) => {
      const result = validator(item);
      if (!result.success) {
        const zodError = result.error as { issues?: Array<{ message: string }> };
        errors.push({ index, message: zodError.issues?.map((i) => i.message).join(', ') || 'Invalid item' });
      }
    });
    if (errors.length > 0) {
      return NextResponse.json({ error: 'validation_failed', details: errors }, { status: 400 });
    }
  }

  const now = new Date().toISOString();
  const results: { saved: number; errors: string[] } = { saved: 0, errors: [] };

  for (const item of items) {
    try {
      const data: Record<string, unknown> = { ...(item as Record<string, unknown>) };
      data.updatedAt = now;
      if (!data.createdAt) data.createdAt = now;
      data.userId = session.userId;

      // Remove id if empty (Prisma will generate)
      if (!data.id) delete data.id;

      await (prisma as any)[modelInfo.model].create({ data });
      results.saved++;
    } catch (e: any) {
      results.errors.push(e.message);
    }
  }

  if (results.errors.length > 0) {
    return NextResponse.json({ error: 'partial_save', saved: results.saved, errors: results.errors }, { status: 500 });
  }
  return NextResponse.json({ saved: results.saved });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ table: string }> }) {
  const session = await auth(req);
  if (session instanceof NextResponse) return session;
  const { table } = await ctx.params;
  const modelInfo = MODEL_MAP[table];
  if (!modelInfo) return NextResponse.json({ error: 'unknown_table' }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { ids?: string[]; patch?: Record<string, unknown> } | null;
  if (!body || !body.ids || !body.patch) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const validator = VALIDATORS[table];
  if (validator && body.patch) {
    const result = validator(body.patch);
    if (!result.success) {
      const zodError = result.error as { issues?: Array<{ message: string }> };
      return NextResponse.json(
        { error: 'validation_failed', details: zodError.issues?.map((i) => i.message).join(', ') },
        { status: 400 },
      );
    }
  }

  const data: Record<string, unknown> = { ...body.patch, updatedAt: new Date().toISOString() };
  delete data.id;
  delete data.createdAt;

  let updated = 0;
  for (const id of body.ids) {
    try {
      await (prisma as any)[modelInfo.model].update({ where: { id }, data });
      updated++;
    } catch {
      /* skip individual failures */
    }
  }
  return NextResponse.json({ ok: true, updated });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ table: string }> }) {
  const session = await auth(req);
  if (session instanceof NextResponse) return session;
  const { table } = await ctx.params;
  const modelInfo = MODEL_MAP[table];
  if (!modelInfo) return NextResponse.json({ error: 'unknown_table' }, { status: 404 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'bad_id' }, { status: 400 });

  try {
    await (prisma as any)[modelInfo.model].delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }
}
