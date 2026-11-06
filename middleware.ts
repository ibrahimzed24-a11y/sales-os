import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth-utils';

const COOKIE_NAME = 'sales-os-session';

function getSession(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) return null;
  return verifyToken(cookie);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow auth pages and API auth routes without session
  if (pathname.startsWith('/auth') || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Allow static assets and Next internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/api/seed') ||
    pathname.startsWith('/api/crm') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Protect all API routes with session check
  if (pathname.startsWith('/api')) {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Protect all pages with session check
  const session = getSession(req);
  if (!session) {
    const signInUrl = new URL('/auth/signin', req.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)'],
};
