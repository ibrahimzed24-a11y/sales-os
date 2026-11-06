import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    senderEmail: process.env.SENDER_EMAIL || 'sales@health.valioz.com',
  });
}
