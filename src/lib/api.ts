'use client';

function code(): string {
  let c = localStorage.getItem('sales-os-access') ?? '';
  if (!c) {
    c = window.prompt('Sales OS access code') ?? '';
    if (c) localStorage.setItem('sales-os-access', c);
  }
  return c;
}

export async function dbCall<T = Record<string, unknown>>(method: string, url: string, body?: unknown): Promise<T> {
  const call = () =>
    fetch(url, {
      method,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'x-access-code': code() },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  let r = await call();
  if (r.status === 401) {
    localStorage.removeItem('sales-os-access');
    r = await call();
  }
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error ?? 'HTTP ' + r.status);
  return j;
}
