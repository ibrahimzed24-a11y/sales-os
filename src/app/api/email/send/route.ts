import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const FROM_EMAIL = process.env.SENDER_EMAIL || 'sales@health.valioz.com';

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

export async function POST(req: Request) {
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
