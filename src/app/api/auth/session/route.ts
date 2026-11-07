import { NextResponse } from 'next/server';
import { compare, hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken, verifyToken, COOKIE_NAME } from '@/lib/auth-utils';
import { createRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const rateLimit = createRateLimiter();

function ipOf(req: Request) {
  return req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
}

function withSession(user: { id: string; email: string; name: string | null; role: string }) {
  const token = signToken({ userId: user.id, email: user.email, role: user.role });
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

export async function POST(req: Request) {
  const rl = rateLimit(ipOf(req));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  // The body can only be read once: parse it a single time and use it for every action.
  const body = (await req.json().catch(() => ({}))) as { action?: string; name?: string; email?: string; password?: string; accessCode?: string };
  const email = (body.email ?? '').trim().toLowerCase();

  try {
    if (body.action === 'signin') {
      if (!email || !body.password) return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
      const user = await prisma.appUser.findUnique({ where: { email } });
      if (!user || !(await compare(body.password, user.passwordHash))) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
      return withSession(user);
    }

    if (body.action === 'signup') {
      const name = (body.name ?? '').trim();
      if (!name || !email || !body.password) return NextResponse.json({ error: 'Full name, email and password are required' }, { status: 400 });
      if (name.length > 100) return NextResponse.json({ error: 'Name is too long' }, { status: 400 });
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
      if (body.password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
      if (body.password.length > 72) return NextResponse.json({ error: 'Password must be at most 72 characters' }, { status: 400 });
      // Public registration: the first account is the admin, every later account is a normal REP user.
      // Each user only ever sees rows stamped with their own owner_id (see /api/db and /api/send-os).
      const count = await prisma.appUser.count();
      if (await prisma.appUser.findUnique({ where: { email } })) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
      const user = await prisma.appUser.create({
        data: { name, email, passwordHash: await hash(body.password, 12), role: count === 0 ? 'ADMIN' : 'REP' },
      });
      return withSession(user);
    }

    if (body.action === 'signout') {
      const res = NextResponse.json({ success: true });
      res.cookies.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
      return res;
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2002') return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    console.error('auth_failed', e instanceof Error ? e.message.split('\n').pop() : e);
    return NextResponse.json({ error: 'Service unavailable, try again' }, { status: 503 });
  }
}

export async function GET(req: Request) {
  const m = (req.headers.get('cookie') ?? '').match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  const payload = m ? verifyToken(m[1]) : null;
  if (!payload) return NextResponse.json({ authenticated: false }, { status: 401 });
  try {
    const user = await prisma.appUser.findUnique({ where: { id: payload.userId } });
    if (!user) return NextResponse.json({ authenticated: false }, { status: 401 });
    return NextResponse.json({ authenticated: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch {
    return NextResponse.json({ authenticated: false, error: 'db_read_failed' }, { status: 503 });
  }
}
