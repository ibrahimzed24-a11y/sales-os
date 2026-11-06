import { NextResponse } from 'next/server';
import { check, COLS, list, patch, remove, upsert } from '@/lib/server';
<<<<<<< HEAD
import {
  validateAccount,
  validateContact,
  validateDeal,
  validateActivity,
  validateProduct,
  validateQuote,
  validatePlaybookItem,
  type AccountInput,
  type ContactInput,
  type DealInput,
  type ActivityInput,
  type ProductInput,
  type QuoteInput,
  type PlaybookItemInput,
} from '@/lib/validation';
=======
>>>>>>> origin/main

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ table: string }> };
type Body = Record<string, unknown>;

<<<<<<< HEAD
const VALIDATORS: Record<string, (data: unknown) => { success: boolean; data?: unknown; error?: unknown }> = {
  accounts: (d) => validateAccount(d),
  contacts: (d) => validateContact(d),
  deals: (d) => validateDeal(d),
  activities: (d) => validateActivity(d),
  products: (d) => validateProduct(d),
  quotes: (d) => validateQuote(d),
  playbooks: (d) => validatePlaybookItem(d),
};

=======
>>>>>>> origin/main
async function guard(req: Request, ctx: Ctx, write: boolean): Promise<{ table: string } | NextResponse> {
  const bad = check(req);
  if (bad) return NextResponse.json(await bad.json(), { status: bad.status });
  const { table } = await ctx.params;
  if (!COLS[table] || (write && table === 'import_jobs')) return NextResponse.json({ error: 'unknown_table' }, { status: 404 });
  return { table };
}

const out = (res: Record<string, unknown>) =>
  NextResponse.json(res, { status: res.error ? (res.error === 'empty_patch' || res.error === 'bad_id' ? 400 : 502) : 200 });

<<<<<<< HEAD
function validateItems(table: string, items: Body[]): { valid: Body[]; errors: { index: number; message: string }[] } {
  const validator = VALIDATORS[table];
  const valid: Body[] = [];
  const errors: { index: number; message: string }[] = [];
  if (!validator) {
    // No schema for this table; pass through
    return { valid: items, errors: [] };
  }
  items.forEach((item, index) => {
    const result = validator(item);
    if (result.success) {
      valid.push(result.data as Body);
    } else {
      const zodError = result.error as { issues?: Array<{ message: string }> };
      errors.push({ index, message: zodError.issues?.map((i) => i.message).join(', ') || 'Invalid item' });
    }
  });
  return { valid, errors };
}

=======
>>>>>>> origin/main
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
<<<<<<< HEAD

  // Validate each item
  const { valid, errors } = validateItems(g.table, items);
  if (errors.length > 0) {
    return NextResponse.json({ error: 'validation_failed', details: errors }, { status: 400 });
  }

  for (const i of valid) {
=======
  for (const i of items) {
>>>>>>> origin/main
    const needsName = g.table === 'accounts' || g.table === 'campaigns' || g.table === 'email_templates';
    if (typeof i.id !== 'string' || !i.id || (needsName && !String(i.name ?? '').trim())) {
      return NextResponse.json({ error: 'invalid_item' }, { status: 400 });
    }
  }
<<<<<<< HEAD
  return out(await upsert(g.table, valid, new URL(req.url).searchParams.get('ignore') === '1'));
=======
  return out(await upsert(g.table, items, new URL(req.url).searchParams.get('ignore') === '1'));
>>>>>>> origin/main
}

export async function PATCH(req: Request, ctx: Ctx) {
  const g = await guard(req, ctx, true);
  if (g instanceof NextResponse) return g;
  const body = (await req.json().catch(() => null)) as Parameters<typeof patch>[1] | null;
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
<<<<<<< HEAD

  // Validate patch fields if a patch object is provided
  if (body.patch) {
    const validator = VALIDATORS[g.table];
    if (validator) {
      const result = validator(body.patch);
      if (!result.success) {
        const zodError = result.error as { issues?: Array<{ message: string }> };
        return NextResponse.json(
          { error: 'validation_failed', details: zodError.issues?.map((i) => i.message).join(', ') },
          { status: 400 },
        );
      }
    }
  }

=======
>>>>>>> origin/main
  return out(await patch(g.table, body));
}

export async function DELETE(req: Request, ctx: Ctx) {
  const g = await guard(req, ctx, true);
  if (g instanceof NextResponse) return g;
  return out(await remove(g.table, new URL(req.url).searchParams.get('id') ?? ''));
}
