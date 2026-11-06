import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

export const dynamic = 'force-dynamic';

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
const ACCESS = process.env.ACCESS_CODE;
const WORKSPACE = 'default';

const headers = () => ({ apikey: KEY ?? '', 'Content-Type': 'application/json' });

function authorized(req: Request) {
  if (!ACCESS) return false;
  const given = req.headers.get('x-access-code') ?? '';
  const a = Buffer.from(given);
  const b = Buffer.from(ACCESS);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!URL_ || !KEY) return NextResponse.json({ configured: false, data: null });
  if (!authorized(req)) return NextResponse.json({ configured: true, error: 'unauthorized' }, { status: 401 });
  const r = await fetch(`${URL_}/rest/v1/sales_os_state?workspace=eq.${WORKSPACE}&select=data,updated_at`, {
    headers: headers(),
    cache: 'no-store',
  });
  if (!r.ok) return NextResponse.json({ configured: true, error: 'db_read_failed', status: r.status }, { status: 502 });
  const rows = (await r.json()) as { data: unknown; updated_at: string }[];
  return NextResponse.json({ configured: true, data: rows[0]?.data ?? null, updatedAt: rows[0]?.updated_at ?? null });
}

export async function PUT(req: Request) {
  if (!URL_ || !KEY) return NextResponse.json({ configured: false }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object' || !body.settings) {
    return NextResponse.json({ error: 'invalid_state' }, { status: 400 });
  }
  const r = await fetch(`${URL_}/rest/v1/sales_os_state?on_conflict=workspace`, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ workspace: WORKSPACE, data: body, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) return NextResponse.json({ error: 'db_write_failed', status: r.status }, { status: 502 });
  return NextResponse.json({ configured: true, saved: true });
}
