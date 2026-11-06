import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Official default From address for Sales OS (public, not a secret).
const DEFAULT_SENDER = 'sales@health.valioz.com';

export function GET() {
  return NextResponse.json({
    senderEmail: process.env.SENDER_EMAIL || DEFAULT_SENDER,
    webmailUrl: 'https://webmail.hostinger.com/',
  });
}
