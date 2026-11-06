import { NextResponse } from 'next/server';
import { check, COLS, list, patch, remove, upsert } from '@/lib/server';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ table: string }> };
type Body = Record<string, unknown>;

async function guard(req: Request, ctx: Ctx, write: boolean): Promise<{ table: string } | NextResponse> {
  const bad = check(req);
  if (bad) return NextResponse.json(await bad.json(), { status: bad.status });
  const { table } = await ctx.params;
  if (!COLS[table] || (write && table === 'import_jobs')) return NextResponse.json({ error: 'unknown_table' }, { status: 404 });
  return { table };
}

const out = (res: Record<string, unknown>) =>
  NextResponse.json(res, { status: res.error ? (res.error === 'empty_patch' || res.error === 'bad_id' ? 400 : 502) : 200 });

export async function GET(req: Request, ctx: Ctx) {
  const g = await guard(req, ctx, false);
  if (g instanceof NextResponse) return g;
  return out(await list(g.table, new URL(req.url).searchParams));
}

export async function POST(req: Request, ctx: Ctx) {
  const g = await guard(req, ctx, true);
  if (g instanceof NextResponse) return g;
  const body = (await req.json().catch(() => null)) as { items?: Body[]; item?: Body } | null;
  const items = body?.items ?? (body?.item ? [body.item] : []);
  if (items.length === 0 || items.length > 2000) return NextResponse.json({ error: 'invalid_items' }, { status: 400 });
  for (const i of items) {
    const needsName = g.table === 'accounts' || g.table === 'campaigns' || g.table === 'email_templates';
    if (typeof i.id !== 'string' || !i.id || (needsName && !String(i.name ?? '').trim())) {
      return NextResponse.json({ error: 'invalid_item' }, { status: 400 });
    }
  }
  return out(await upsert(g.table, items, new URL(req.url).searchParams.get('ignore') === '1'));
}

export async function PATCH(req: Request, ctx: Ctx) {
  const g = await guard(req, ctx, true);
  if (g instanceof NextResponse) return g;
  const body = (await req.json().catch(() => null)) as Parameters<typeof patch>[1] | null;
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  return out(await patch(g.table, body));
}

export async function DELETE(req: Request, ctx: Ctx) {
  const g = await guard(req, ctx, true);
  if (g instanceof NextResponse) return g;
  return out(await remove(g.table, new URL(req.url).searchParams.get('id') ?? ''));
}
