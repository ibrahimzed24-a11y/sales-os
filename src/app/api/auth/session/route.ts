import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { compare, hash } from 'bcryptjs';
import { signToken, COOKIE_NAME } from '@/lib/auth-utils';
import { createRateLimiter } from '@/lib/rate-limit';

const rateLimit = createRateLimiter();

function ipOf(req: Request) {
  return req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(req: Request) {
  const rl = rateLimit(ipOf(req));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  const { action } = await req.json().catch(() => ({})) as { action?: string };

  if (action === 'signin') {
    const { email, password } = await req.json().catch(() => ({})) as { email?: string; password?: string };
    if (!email || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const isValid = await compare(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const token = signToken({ userId: user.id, email: user.email!, role: user.role });
    const res = NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
    return res;
  }

  if (action === 'signup') {
    const { name, email, password } = await req.json().catch(() => ({})) as { name?: string; email?: string; password?: string };
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }
    const hashedPassword = await hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: 'REP' },
    });
    const token = signToken({ userId: user.id, email: user.email!, role: user.role });
    const res = NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
    return res;
  }

  if (action === 'signout') {
    const res = NextResponse.json({ success: true });
    res.cookies.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
    return res;
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function GET(req: Request) {
  const session = (req.headers.get('cookie') ?? '').match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  const { verifyToken } = await import('@/lib/auth-utils');
  const payload = verifyToken(session[1]);
  if (!payload) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
}
