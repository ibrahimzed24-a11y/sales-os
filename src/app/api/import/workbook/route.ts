import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromCookie } from '@/lib/auth-utils';
import { EMAIL_RE } from '@/lib/campaign';

// Workbook import: one row = one clinic (account) + its contact. Owner-scoped, fill-blanks-only updates,
// unmapped columns kept in custom_data. dryRun (the default) checks everything and writes nothing.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Row = Record<string, any>;
type Issue = { row: number; status: string; reason: string; value: string };
const s = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v)).trim();
const blank = (v: unknown) => v == null || s(v) === '';
const domainOf = (w: string) => w.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0].toLowerCase();
const UUID = /^[0-9a-f-]{36}$/i;

function cleanCustom(c: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!c || typeof c !== 'object' || Array.isArray(c)) return out;
  for (const [k, v] of Object.entries(c as Record<string, unknown>).slice(0, 100)) {
    const key = s(k).slice(0, 80), val = s(v).slice(0, 2000);
    if (key && val && key !== '__proto__' && key !== 'constructor') out[key] = val;
  }
  return out;
}
// Values already stored win; only missing or blank keys are added.
function mergeCustom(old: unknown, add: Record<string, string>) {
  const merged: Record<string, unknown> = old && typeof old === 'object' && !Array.isArray(old) ? { ...(old as Record<string, unknown>) } : {};
  let changed = false;
  for (const [k, v] of Object.entries(add)) if (blank(merged[k])) { merged[k] = v; changed = true; }
  return { merged, changed };
}

export async function POST(req: Request) {
  const sess = getSessionFromCookie(req.headers.get('cookie'));
  if (!sess || !UUID.test(sess.userId)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const uid = sess.userId;
  const b = (await req.json().catch(() => null)) as { rows?: Row[]; dryRun?: boolean; createContacts?: boolean } | null;
  const rows = Array.isArray(b?.rows) ? b!.rows : [];
  if (!rows.length || rows.length > 500) return NextResponse.json({ error: 'Send between 1 and 500 rows per request' }, { status: 400 });
  const dryRun = b?.dryRun !== false;
  const withContacts = b?.createContacts !== false;
  const q = <T = Row>(sql: string, ...p: unknown[]) => prisma.$queryRawUnsafe<T[]>(sql, uid, ...p);
  const x = (sql: string, ...p: unknown[]) => prisma.$executeRawUnsafe(sql, uid, ...p);

  const accs = await q('select id, name, city, province_state, domain, website, phone, custom_data from accounts where owner_id = $1::uuid');
  const cons = await q('select id, account_id, first_name, last_name, email, phone, role, custom_data from contacts where owner_id = $1::uuid');
  const byPlace = new Map<string, Row>(), byName = new Map<string, Row[]>(), byEmail = new Map<string, Row>();
  const addAcc = (a: Row) => {
    const p = s(a.custom_data?.google_place_id).toLowerCase();
    if (p) byPlace.set(p, a);
    const k = s(a.name).toLowerCase(); byName.set(k, [...(byName.get(k) ?? []), a]);
  };
  accs.forEach(addAcc);
  cons.forEach((c) => { if (c.email) byEmail.set(s(c.email).toLowerCase(), c); });

  const n = { created: 0, updated: 0, skipped: 0, invalid: 0, failed: 0, accountsCreated: 0, accountsUpdated: 0, contactsCreated: 0, contactsUpdated: 0 };
  const issues: Issue[] = [], warnings: Issue[] = [];

  for (const r of rows) {
    const rowNo = Number(r.row) || 0;
    try {
      const clinic = s(r.clinic).slice(0, 200);
      let email = s(r.email).toLowerCase().slice(0, 254);
      if (email && !EMAIL_RE.test(email)) { warnings.push({ row: rowNo, status: 'warning', reason: 'Invalid email, saved without it', value: email }); email = ''; }
      if (!clinic && (!withContacts || !email)) { n.invalid++; issues.push({ row: rowNo, status: 'invalid', reason: withContacts ? 'No clinic name and no valid email' : 'No clinic name', value: s(r.email) }); continue; }
      const custom = cleanCustom(r.custom);
      const city = s(r.city), prov = s(r.province), website = s(r.website), phone = s(r.phone).slice(0, 60), role = s(r.role).slice(0, 120);
      const frontDesk = s(r.frontDesk);
      let made = false, changed = false;

      let acc: Row | null = null;
      if (clinic) {
        const place = s(custom.google_place_id).toLowerCase();
        acc = (place && byPlace.get(place)) || (byName.get(clinic.toLowerCase()) ?? []).find((a) => !city || !a.city || s(a.city).toLowerCase() === city.toLowerCase()) || null;
        const vals: Record<string, string> = { domain: website ? domainOf(website) : '', website, city, province_state: prov, phone };
        if (acc) {
          const sets: string[] = [], params: unknown[] = [];
          for (const [col, v] of Object.entries(vals)) if (v && blank(acc[col])) { params.push(v); sets.push(col + '=$' + (params.length + 2)); acc[col] = v; }
          const m = mergeCustom(acc.custom_data, custom);
          if (m.changed) { params.push(JSON.stringify(m.merged)); sets.push('custom_data=$' + (params.length + 2) + '::jsonb'); acc.custom_data = m.merged; }
          if (sets.length) {
            if (!dryRun && !String(acc.id).startsWith('dry-')) await x('update accounts set ' + sets.join(', ') + ', updated_at=now() where owner_id = $1::uuid and id = $2::uuid', acc.id, ...params);
            n.accountsUpdated++; changed = true;
          }
        } else {
          let id = 'dry-' + rowNo;
          if (!dryRun) id = (await q<{ id: string }>("insert into accounts (owner_id, name, domain, website, city, province_state, phone, custom_data) values ($1::uuid, $2, nullif($3,''), nullif($4,''), nullif($5,''), nullif($6,''), nullif($7,''), $8::jsonb) returning id", clinic, vals.domain, website, city, prov, phone, JSON.stringify(custom)))[0].id;
          acc = { id, name: clinic, ...vals, custom_data: custom };
          addAcc(acc); n.accountsCreated++; made = true;
        }
      }
      const accountId = acc && !String(acc.id).startsWith('dry-') ? acc.id : null;

      if (withContacts) {
        let name = s(r.contact), defRole = '';
        if (!name && frontDesk) { name = frontDesk; defRole = 'Front Desk'; }
        const parts = name.split(/\s+/).filter(Boolean);
        const hasPerson = parts.length > 0;
        const first = hasPerson ? parts[0] : 'Front Desk', last = hasPerson ? parts.slice(1).join(' ') : clinic || email;
        const ccustom = { ...custom, ...(frontDesk ? { front_desk: frontDesk } : {}) };
        let con: Row | undefined = email ? byEmail.get(email) : undefined;
        if (!con && !email && acc) con = cons.find((c) => c.account_id === acc!.id && !c.email && s(c.first_name).toLowerCase() === first.toLowerCase() && s(c.last_name).toLowerCase() === last.toLowerCase());
        if (con) {
          const sets: string[] = [], params: unknown[] = [];
          const put = (col: string, v: unknown, cast = '') => { params.push(v); sets.push(col + '=$' + (params.length + 2) + cast); };
          if (accountId && !con.account_id) put('account_id', accountId, '::uuid');
          if (hasPerson && (blank(con.first_name) || s(con.first_name) === 'Front Desk')) { put('first_name', first); put('last_name', last); }
          if (phone && blank(con.phone)) put('phone', phone);
          if ((role || defRole) && blank(con.role)) put('role', role || defRole);
          const m = mergeCustom(con.custom_data, ccustom);
          if (m.changed) { put('custom_data', JSON.stringify(m.merged), '::jsonb'); con.custom_data = m.merged; }
          if (sets.length) {
            if (!dryRun && !String(con.id).startsWith('dry-')) await x('update contacts set ' + sets.join(', ') + ', updated_at=now() where owner_id = $1::uuid and id = $2::uuid', con.id, ...params);
            n.contactsUpdated++; changed = true;
          }
        } else {
          let id = 'dry-c' + rowNo;
          if (!dryRun) id = (await q<{ id: string }>("insert into contacts (owner_id, account_id, first_name, last_name, email, phone, role, source, tags, custom_data) values ($1::uuid, $2::uuid, $3, $4, nullif($5,''), nullif($6,''), nullif($7,''), 'Outbound', ARRAY['upload']::text[], $8::jsonb) returning id", accountId, first, last, email, phone, role || defRole, JSON.stringify(ccustom)))[0].id;
          const nc = { id, account_id: acc?.id ?? null, first_name: first, last_name: last, email: email || null, phone, role, custom_data: ccustom };
          cons.push(nc); if (email) byEmail.set(email, nc);
          n.contactsCreated++; made = true;
        }
      }
      if (made) n.created++;
      else if (changed) n.updated++;
      else { n.skipped++; issues.push({ row: rowNo, status: 'skipped', reason: 'Already in Sales OS, nothing new to add', value: clinic || email }); }
    } catch (err) {
      n.failed++;
      issues.push({ row: rowNo, status: 'failed', reason: 'Database error: ' + (err instanceof Error ? err.message.split('\n').pop()!.slice(0, 160) : 'failed'), value: '' });
    }
  }
  return NextResponse.json({ dryRun, total: rows.length, ...n, issues, warnings });
}
