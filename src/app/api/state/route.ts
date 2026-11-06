import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'sales-os-session';

function getSession(req: Request): { userId: string; email: string; role: string } | null {
  const cookie = req.headers.get('cookie') ?? '';
  const match = cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  return verifyToken(match[1]);
}

async function auth(req: Request) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return session;
}

export async function GET(req: Request) {
  const session = await auth(req);
  if (session instanceof NextResponse) return session;

  // Return user's settings and counts as a lightweight state check
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      _count: { select: { contacts: true, deals: true, activities: true, quotes: true } },
    },
  });
  if (!user) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });

  return NextResponse.json({ configured: true, user, data: null });
}

export async function PUT(req: Request) {
  const session = await auth(req);
  if (session instanceof NextResponse) return session;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid_state' }, { status: 400 });
  }

  // Update user settings (we store settings as a JSON field on user or use a separate table)
  // For now, we just acknowledge the save - settings are managed client-side
  return NextResponse.json({ configured: true, saved: true });
}
