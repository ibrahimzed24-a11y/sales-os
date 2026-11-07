import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Supabase's transaction pooler (port 6543) needs pgbouncer mode, and serverless functions need a tiny pool.
function dbUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (u.port === '6543' || u.hostname.includes('pooler.supabase.com')) {
      if (!u.searchParams.has('pgbouncer')) u.searchParams.set('pgbouncer', 'true');
    }
    if (!u.searchParams.has('connection_limit')) u.searchParams.set('connection_limit', '3');
    return u.toString();
  } catch {
    return raw;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: dbUrl(),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
