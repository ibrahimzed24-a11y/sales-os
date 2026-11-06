'use client';

import { toast } from 'sonner';

function code(): string {
  let c = localStorage.getItem('sales-os-access') ?? '';
  if (!c) {
    c = window.prompt('Sales OS access code') ?? '';
    if (c) localStorage.setItem('sales-os-access', c);
  }
  return c;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export async function dbCall<T = Record<string, unknown>>(
  method: string,
  url: string,
  body?: unknown,
  { silent = false }: { silent?: boolean } = {},
): Promise<T> {
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
    if (r.status === 401) {
      localStorage.removeItem('sales-os-access');
      if (!silent) toast.error('Session expired. Please enter your access code again.');
      throw new ApiError('Unauthorized', 401);
    }
  }
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) {
    if (!silent) toast.error(j.error ?? `HTTP ${r.status}`);
    throw new ApiError(j.error ?? `HTTP ${r.status}`, r.status);
  }
  return j;
}
