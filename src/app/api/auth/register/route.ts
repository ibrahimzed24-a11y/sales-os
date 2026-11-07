import { POST as sessionPost } from '../session/route';

export const dynamic = 'force-dynamic';

// Registration shares the rules of /api/auth/session (first account is the admin, later ones need ACCESS_CODE).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return sessionPost(
    new Request(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify({ ...body, action: 'signup' }) }),
  );
}
