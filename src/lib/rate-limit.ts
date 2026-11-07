export function createRateLimiter({ windowMs = 60 * 1000, max = 120 } = {}) {
  const map = new Map<string, { count: number; resetAt: number }>();
  return (ip: string) => {
    const now = Date.now();
    let entry = map.get(ip);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      map.set(ip, entry);
    }
    entry.count++;
    return {
      allowed: entry.count <= max,
      remaining: Math.max(0, max - entry.count),
      resetAt: entry.resetAt,
    };
  };
}
