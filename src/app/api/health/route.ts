import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    app: 'sales-os',
    time: new Date().toISOString(),
    database: process.env.DATABASE_URL ? 'postgresql' : 'local-only',
    auth: !!process.env.JWT_SECRET,
  });
}
