import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { verifyToken } from '@/lib/auth-utils';
import { sendReadiness } from '@/lib/send-safeguards';

export const dynamic = 'force-dynamic';

const FROM_EMAIL = process.env.SENDER_EMAIL || 'sales@health.valioz.com';

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

function getSession(req: Request): { userId: string; email: string; role: string } | null {
  const cookie = req.headers.get('cookie') ?? '';
  const match = cookie.match(new RegExp(`(?:^|; )sales-os-session=([^;]+)`));
  if (!match) return null;
  return verifyToken(match[1]);
}

export async function POST(req: Request) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Sending emails is limited to administrators.' }, { status: 403 });
  }

  // CASL safeguard: no send without a valid legal name, mailing address and an enabled unsubscribe link.
  const gate = sendReadiness();
  if (!gate.ok) {
    return NextResponse.json({ error: 'Sending is blocked: ' + gate.reasons.join(' '), blocked: true, reasons: gate.reasons }, { status: 409 });
  }

  const resend = getResend();
  if (!resend) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY not configured' },
      { status: 500 },
    );
  }

  try {
    const { to, subject, html, text } = await req.json();

    if (!to || !subject) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const data = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      text,
    });

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, id: data.data?.id });
  } catch (err) {
    console.error('Email send error:', err);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 },
    );
  }
}
