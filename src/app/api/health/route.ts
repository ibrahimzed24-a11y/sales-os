import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    app: 'sales-os',
    time: new Date().toISOString(),
    database: process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY ? 'supabase' : 'local-store',
    protected: !!process.env.ACCESS_CODE,
  });
}
