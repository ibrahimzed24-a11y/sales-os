import { getSessionFromCookie, verifyToken } from '@/lib/auth-utils';

export async function getServerSession(req: Request) {
  return getSessionFromCookie(req.headers.get('cookie'));
}

export function requireRole(allowedRoles: string[]) {
  return (session: { role: string } | null) => {
    if (!session) return false;
    return allowedRoles.includes(session.role);
  };
}
