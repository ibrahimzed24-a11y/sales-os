import { describe, it, expect, beforeAll } from 'vitest';

let JWT_SECRET: string;
let signToken: (payload: { userId: string; email: string; role: string }) => string;
let verifyToken: (token: string) => { userId: string; email: string; role: string } | null;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-do-not-use-in-production';
  const mod = await import('@/lib/auth-utils');
  JWT_SECRET = mod.JWT_SECRET;
  signToken = mod.signToken;
  verifyToken = mod.verifyToken;
});

describe('auth utils', () => {
  it('JWT_SECRET is set and not the fallback', () => {
    expect(JWT_SECRET).toBeDefined();
    expect(JWT_SECRET!).not.toBe('fallback-secret-change-in-production');
  });

  it('signs and verifies a token', () => {
    const token = signToken({ userId: 'u_1', email: 'a@b.com', role: 'REP' });
    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe('u_1');
    expect(payload?.email).toBe('a@b.com');
    expect(payload?.role).toBe('REP');
  });

  it('rejects a tampered token', () => {
    const bad = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.signature';
    expect(verifyToken(bad)).toBeNull();
  });

  it('rejects an empty string', () => {
    expect(verifyToken('')).toBeNull();
  });
});
