import { sign, verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const COOKIE_NAME = 'sales-os-session';

export { COOKIE_NAME, JWT_SECRET };

export function signToken(payload: { userId: string; email: string; role: string }): string {
  return sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): { userId: string; email: string; role: string } | null {
  try {
    return verify(token, JWT_SECRET) as { userId: string; email: string; role: string };
  } catch {
    return null;
  }
}

export function getSessionFromCookie(cookieHeader: string | null): { userId: string; email: string; role: string } | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  return verifyToken(match[1]);
}
