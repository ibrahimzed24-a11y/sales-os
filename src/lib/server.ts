import { timingSafeEqual } from 'crypto';

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
const ACCESS = process.env.ACCESS_CODE;

export function check(req: Request): Response | null {
  if (!URL_ || !KEY) return Response.json({ configured: false, error: 'not_configured' }, { status: 503 });
  if (!ACCESS) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const a = Buffer.from(req.headers.get('x-access-code') ?? '');
  const b = Buffer.from(ACCESS);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  return null;
}

export function sb(path: string, init: RequestInit = {}, prefer?: string): Promise<Response> {
  return fetch(URL_ + '/rest/v1/' + path, {
    ...init,
    cache: 'no-store',
    headers: { apikey: KEY ?? '', 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
  });
}

export const COLS: Record<string, string[]> = {
  accounts: ['id', 'name', 'domain', 'industry', 'size', 'annual_revenue', 'tier', 'created_at'],
  contacts: ['id', 'account_id', 'first_name', 'last_name', 'email', 'phone', 'role', 'lead_status', 'lead_score', 'source', 'tags', 'owner', 'last_contacted_at', 'created_at'],
  email_templates: ['id', 'name', 'subject', 'body', 'created_at'],
  campaigns: ['id', 'name', 'status', 'subject', 'template_id', 'audience', 'daily_limit', 'notes', 'created_at'],
  email_logs: ['id', 'campaign_id', 'contact_id', 'to_email', 'subject', 'body', 'status', 'error', 'gmail_message_id', 'prepared_at', 'sent_at', 'created_at'],
  import_jobs: ['id', 'entity', 'file_name', 'total', 'imported', 'skipped', 'report', 'created_at'],
};

const EMBED: Record<string, string> = { contacts: ',accounts(name)', accounts: ',contacts(count)' };

const SORTS: Record<string, string[]> = {
  contacts: ['created_at', 'first_name', 'last_name', 'email', 'lead_score', 'lead_status', 'source', 'owner'],
  accounts: ['created_at', 'name', 'tier', 'industry', 'annual_revenue', 'size'],
  campaigns: ['created_at', 'name', 'status'],
  email_logs: ['created_at', 'status', 'to_email'],
  email_templates: ['created_at', 'name'],
  import_jobs: ['created_at'],
};

const FILTERS: Record<string, Record<string, string>> = {
  contacts: { leadStatus: 'lead_status', source: 'source', owner: 'owner', accountId: 'account_id', id: 'id' },
  accounts: { tier: 'tier', industry: 'industry', id: 'id' },
  campaigns: { status: 'status', id: 'id' },
  email_logs: { campaignId: 'campaign_id', status: 'status', contactId: 'contact_id', id: 'id' },
  email_templates: { id: 'id' },
  import_jobs: { id: 'id', entity: 'entity' },
};

const snake = (k: string) => k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
const camel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export function toDb(table: string, item: Record<string, unknown>): Record<string, unknown> {
  const cols = COLS[table] ?? [];
  const out: Record<string, unknown> = {};
  for (const [k, v0] of Object.entries(item)) {
    const s = snake(k);
    if (!cols.includes(s)) continue;
    let v = v0;
    if ((s.endsWith('_id') || s.endsWith('_at')) && (v === '' || v === undefined)) v = null;
    if (s === 'created_at' && v === null) continue;
    out[s] = v;
  }
  return out;
}

export function fromDb(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'accounts') out.accountName = v && typeof v === 'object' ? (v as { name?: string }).name ?? '' : '';
    else if (k === 'contacts') out.contactCount = Array.isArray(v) ? Number((v[0] as { count?: number } | undefined)?.count ?? 0) : 0;
    else out[camel(k)] = v === null && k.endsWith('_id') ? '' : v;
  }
  return out;
}

const enc = (qs: URLSearchParams) => qs.toString().replace(/\+/g, '%20');

export function filterQS(table: string, sp: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const [param, col] of Object.entries(FILTERS[table] ?? {})) {
    const v = sp.get(param);
    if (v) out.append(col, 'eq.' + v);
  }
  const tag = sp.get('tag');
  if (table === 'contacts' && tag) out.append('tags', 'cs.{' + tag.replace(/[{}",]/g, '') + '}');
  if (table === 'contacts' && sp.get('hasEmail') === '1') out.append('email_key', 'like.*@*');
  const q = (sp.get('q') ?? '').trim().replace(/[*,()%:"\\]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  if (q) {
    if (table === 'contacts' || table === 'accounts') for (const tok of q.split(' ')) out.append('search', 'ilike.*' + tok + '*');
    else if (table === 'email_logs') out.append('or', '(to_email.ilike.*' + q + '*,subject.ilike.*' + q + '*)');
    else if (table === 'campaigns' || table === 'email_templates') out.append('name', 'ilike.*' + q + '*');
  }
  return out;
}

export async function list(table: string, sp: URLSearchParams) {
  const all = sp.get('all') === '1';
  const pageSize = all ? 1000 : Math.min(200, Math.max(1, Number(sp.get('pageSize')) || 50));
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const qs = filterQS(table, sp);
  qs.set('select', COLS[table].join(',') + (EMBED[table] ?? ''));
  const sortCol = SORTS[table].includes(sp.get('sort') ?? '') ? sp.get('sort') : 'created_at';
  qs.set('order', sortCol + '.' + (sp.get('dir') === 'asc' ? 'asc' : 'desc') + ',id.asc');
  qs.set('limit', String(pageSize));
  qs.set('offset', String((page - 1) * pageSize));
  const r = await sb(table + '?' + enc(qs), {}, 'count=exact');
  if (!r.ok) return { error: 'db_read_failed', status: r.status };
  const rows = (await r.json()) as Record<string, unknown>[];
  const total = Number((r.headers.get('content-range') ?? '').split('/')[1]);
  return { rows: rows.map(fromDb), total: Number.isFinite(total) ? total : rows.length, page, pageSize };
}

export async function upsert(table: string, items: Record<string, unknown>[], ignore: boolean) {
  const now = new Date().toISOString();
  const rows = items.map((i) => ({ ...toDb(table, i), ...(table === 'import_jobs' ? {} : { updated_at: now }) }));
  for (let i = 0; i < rows.length; i += 500) {
    const r = await sb(
      table + '?on_conflict=id',
      { method: 'POST', body: JSON.stringify(rows.slice(i, i + 500)) },
      'resolution=' + (ignore ? 'ignore' : 'merge') + '-duplicates,return=minimal',
    );
    if (!r.ok) return { error: 'db_write_failed', status: r.status, detail: (await r.text()).slice(0, 300) };
  }
  return { saved: rows.length };
}

export async function patch(
  table: string,
  body: { ids?: string[]; all?: boolean; filters?: Record<string, string>; patch?: Record<string, unknown> },
) {
  const p = toDb(table, body.patch ?? {});
  delete p.id;
  delete p.created_at;
  if (Object.keys(p).length === 0) return { error: 'empty_patch' };
  const data = JSON.stringify({ ...p, updated_at: new Date().toISOString() });
  if (body.all) {
    const qs = filterQS(table, new URLSearchParams(body.filters ?? {}));
    if (Array.from(qs.keys()).length === 0) qs.set('id', 'neq.');
    const r = await sb(table + '?' + enc(qs), { method: 'PATCH', body: data }, 'return=minimal');
    return r.ok ? { ok: true } : { error: 'db_write_failed', status: r.status };
  }
  const ids = (body.ids ?? []).filter((x) => /^[\w.-]+$/.test(x));
  for (let i = 0; i < ids.length; i += 100) {
    const r = await sb(table + '?id=in.(' + ids.slice(i, i + 100).join(',') + ')', { method: 'PATCH', body: data }, 'return=minimal');
    if (!r.ok) return { error: 'db_write_failed', status: r.status };
  }
  return { ok: true, updated: ids.length };
}

export async function remove(table: string, id: string) {
  if (!/^[\w.-]+$/.test(id)) return { error: 'bad_id' };
  const r = await sb(table + '?id=eq.' + id, { method: 'DELETE' }, 'return=minimal');
  return r.ok ? { ok: true } : { error: 'db_write_failed', status: r.status };
}
