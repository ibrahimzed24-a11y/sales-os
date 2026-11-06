import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    app: 'sales-os',
    time: new Date().toISOString(),
    database: process.env.DATABASE_URL ? 'configured' : 'local-store',
  });
}
