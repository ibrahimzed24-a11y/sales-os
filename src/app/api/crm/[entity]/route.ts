import { NextResponse } from 'next/server';
import { buildSeed } from '@/lib/seed';
import type { EntityKey } from '@/types/sales-os';

const KEYS: EntityKey[] = ['accounts', 'contacts', 'deals', 'activities', 'products', 'quotes', 'playbooks'];

export async function GET(_req: Request, ctx: { params: Promise<{ entity: string }> }) {
  const { entity } = await ctx.params;
  const key = KEYS.find((k) => k === entity);
  if (!key) return NextResponse.json({ error: 'unknown entity' }, { status: 404 });
  return NextResponse.json({ entity: key, data: buildSeed()[key] });
}
