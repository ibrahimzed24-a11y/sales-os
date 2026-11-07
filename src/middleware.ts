import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Must live in src/ (next to src/app) or Next.js ignores it. Runs on the Edge runtime, so the
// JWT (HS256) is verified with Web Crypto instead of jsonwebtoken. API routes verify it again.
const COOKIE_NAME = 'sales-os-session';

function b64urlToBytes(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

async function validToken(token: string | undefined): Promise<boolean> {
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('HMAC', key, b64urlToBytes(parts[2]) as BufferSource, new TextEncoder().encode(parts[0] + '.' + parts[1]));
    if (!ok) return false;
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1]))) as { exp?: number };
    return !payload.exp || payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // /api/send-os/unsub is the public unsubscribe link in emails; the route checks a signed token itself.
  if (pathname.startsWith('/auth') || pathname.startsWith('/api/auth') || pathname.startsWith('/api/health') || pathname === '/api/send-os/unsub') {
    return NextResponse.next();
  }
  const ok = await validToken(req.cookies.get(COOKIE_NAME)?.value);
  if (pathname.startsWith('/api')) {
    return ok ? NextResponse.next() : NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!ok) {
    const url = new URL('/auth/signin', req.url);
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)'],
};
