import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { compare, hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken, verifyToken, COOKIE_NAME } from '@/lib/auth-utils';
import { createRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const rateLimit = createRateLimiter();

function ipOf(req: Request) {
  return req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
}

function sameCode(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
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
      if (!body.name || !email || !body.password) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      if (body.password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
      // Single-workspace app: the first account is the admin; after that signup needs the ACCESS_CODE.
      const count = await prisma.appUser.count();
      const code = process.env.ACCESS_CODE;
      if (count > 0 && !(code && body.accessCode && sameCode(body.accessCode, code))) {
        return NextResponse.json({ error: 'Registration is closed' }, { status: 403 });
      }
      if (await prisma.appUser.findUnique({ where: { email } })) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
      const user = await prisma.appUser.create({
        data: { name: body.name, email, passwordHash: await hash(body.password, 12), role: count === 0 ? 'ADMIN' : 'REP' },
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
