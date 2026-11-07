import { sign, verify } from 'jsonwebtoken';

const JWT_SECRET_ENV = process.env.JWT_SECRET;
if (!JWT_SECRET_ENV || JWT_SECRET_ENV === 'fallback-secret-change-in-production') {
  throw new Error('JWT_SECRET is required. Set it in .env.local or your deploy env.');
}
const JWT_SECRET = JWT_SECRET_ENV;
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
