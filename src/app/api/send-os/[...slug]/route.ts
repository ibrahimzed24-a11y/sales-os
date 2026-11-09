import { NextResponse } from 'next/server';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID, createHmac, timingSafeEqual } from 'crypto';
import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';
import { getSessionFromCookie, JWT_SECRET } from '@/lib/auth-utils';
import { EMAIL_RE, MAX_PER_RUN, VARIABLES, htmlToText, renderTemplate, tokensIn, type Vars } from '@/lib/campaign';
import { sendReadiness } from '@/lib/send-safeguards';

// One catch-all API for the lead -> template -> campaign workflow:
//   GET  templates | history | unsub (public, signed link)
//   POST templates | leads | preview | send | status
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BASE = process.env.APP_URL || 'https://sales-os-kappa-rosy.vercel.app';
const FROM = process.env.SENDER_EMAIL || 'sales@health.valioz.com';
const RECENT_DAYS = 3;

type Ctx = { params: Promise<{ slug: string[] }> };
type Row = Record<string, any>;

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
const s = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v)).trim();
const digits = (v: string) => v.replace(/\D/g, '');
const domainOf = (w: string) => w.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0].toLowerCase();
const isTestAddr = (e: string) => /@example\.test$/i.test(e);
// Every request runs inside this store so each query can be scoped to the signed-in user (__UID__ = that user's id).
const ctxStore = new AsyncLocalStorage<{ uid: string; role: string }>();
const owner = (sql: string) =>
  sql.replace(/__UID__/g, () => {
    const u = ctxStore.getStore()?.uid ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(u)) throw new Error('No signed-in user');
    return "'" + u + "'::uuid";
  });
const q = <T = Row>(sql: string, ...params: unknown[]) => prisma.$queryRawUnsafe<T[]>(owner(sql), ...params);
const x = (sql: string, ...params: unknown[]) => prisma.$executeRawUnsafe(owner(sql), ...params);

function unsubToken(email: string): string {
  return createHmac('sha256', JWT_SECRET).update(email.toLowerCase()).digest('hex').slice(0, 32);
}
const unsubUrl = (email: string) => BASE + '/api/send-os/unsub?e=' + encodeURIComponent(email) + '&t=' + unsubToken(email);

async function handle(req: Request, ctx: Ctx, method: 'GET' | 'POST') {
  const { slug } = await ctx.params;
  if ((slug ?? []).join('/') === 'unsub') return handleInner(req, ctx, method);
  const sess = getSessionFromCookie(req.headers.get('cookie'));
  if (!sess) return json({ error: 'unauthorized' }, 401);
  return ctxStore.run({ uid: sess.userId, role: sess.role }, () => handleInner(req, ctx, method));
}

async function handleInner(req: Request, ctx: Ctx, method: 'GET' | 'POST') {
  const { slug } = await ctx.params;
  const route = (slug ?? []).join('/');
  try {
    if (route === 'unsub' && method === 'GET') return await unsub(req);
    if (!getSessionFromCookie(req.headers.get('cookie'))) return json({ error: 'unauthorized' }, 401);
    if (method === 'GET' && route === 'templates') return await listTemplates();
    if (method === 'GET' && route === 'history') return await history();
    if (method === 'POST' && route === 'templates') return await saveTemplate(req);
    if (method === 'POST' && route === 'leads') return await leads(req);
    if (method === 'POST' && route === 'preview') return await preview(req);
    if (method === 'POST' && route === 'send') return await send(req);
    if (method === 'POST' && route === 'test-once') return await testOnce(req);
    if (method === 'POST' && route === 'status') return await setStatus(req);
    return json({ error: 'not_found' }, 404);
  } catch (err) {
    console.error('send-os error', route, err);
    return json({ error: err instanceof Error ? err.message : 'failed' }, 500);
  }
}
export async function GET(req: Request, ctx: Ctx) { return handle(req, ctx, 'GET'); }
export async function POST(req: Request, ctx: Ctx) { return handle(req, ctx, 'POST'); }

// ---------- templates ----------
async function listTemplates() {
  const templates = await q(
    'select id, name, subject, body, category, coalesce(variables, ARRAY[]::text[]) as variables, source_file as "sourceFile", created_at as "createdAt" from email_templates where owner_id = __UID__ order by created_at, name',
  );
  return json({ templates });
}

async function saveTemplate(req: Request) {
  const b = await req.json();
  const name = s(b.name).slice(0, 200);
  const subject = s(b.subject).slice(0, 500);
  const body = typeof b.body === 'string' ? b.body : '';
  const category = s(b.category).slice(0, 100) || 'General';
  const sourceFile = s(b.sourceFile).slice(0, 200);
  const variables: string[] = Array.isArray(b.variables) ? b.variables.map((v: unknown) => s(v)).filter(Boolean) : [];
  if (!name || !subject || !body) return json({ error: 'name, subject and body are required' }, 400);
  if (body.length > 400000) return json({ error: 'Template body is too large' }, 400);
  const found = sourceFile ? await q('select id from email_templates where source_file = $1 and owner_id = __UID__ limit 1', sourceFile) : [];
  if (found.length) {
    await x('update email_templates set name=$2, subject=$3, body=$4, category=$5, variables=$6::text[], updated_at=now() where id=$1 and owner_id = __UID__', found[0].id, name, subject, body, category, variables);
    return json({ id: found[0].id, action: 'updated' });
  }
  const id = randomUUID();
  await x('insert into email_templates (owner_id, id, name, subject, body, category, variables, source_file) values (__UID__, $1,$2,$3,$4,$5,$6::text[],$7)', id, name, subject, body, category, variables, sourceFile || null);
  return json({ id, action: 'created' });
}

// ---------- leads: validate, dedupe, create/update (never delete, never blank out) ----------
async function leads(req: Request) {
  const b = await req.json();
  const rows: Row[] = Array.isArray(b.rows) ? b.rows : [];
  if (!rows.length) return json({ error: 'No rows in the upload' }, 400);
  if (rows.length > 5000) return json({ error: 'Maximum 5000 rows per upload' }, 400);
  const dryRun = b.dryRun !== false; // default is a safe check; only dryRun:false writes
  const fileName = s(b.fileName).slice(0, 200);

  const accs = await q('select id, name, city from accounts where owner_id = __UID__');
  const cons = await q('select id, account_id, first_name, last_name, email from contacts where owner_id = __UID__');
  const accByName = new Map<string, Row[]>();
  for (const a of accs) {
    const k = s(a.name).toLowerCase();
    const l = accByName.get(k) ?? [];
    l.push(a);
    accByName.set(k, l);
  }
  const conByEmail = new Map<string, Row>();
  for (const c of cons) if (c.email) conByEmail.set(s(c.email).toLowerCase(), c);

  const seen = new Set<string>();
  const skipped: { row: number; reason: string; value: string }[] = [];
  const warnings: { row: number; reason: string; value: string }[] = [];
  let created = 0, updated = 0, accountsCreated = 0, accountsUpdated = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNo = i + 2; // spreadsheet row (row 1 is the header)
    try {
      const clinic = s(r.clinic_name) || s(r.company);
      let email = s(r.email).toLowerCase();
      if (email && !EMAIL_RE.test(email)) {
        warnings.push({ row: rowNo, reason: 'Invalid email - contact saved without email', value: email });
        email = '';
      }
      if (!clinic && !email) { skipped.push({ row: rowNo, reason: 'No clinic name and no valid email', value: '' }); continue; }
      const phone = s(r.phone);
      const key = email || 'c:' + clinic.toLowerCase() + '|' + digits(phone) + '|' + s(r.contact_name).toLowerCase();
      if (seen.has(key)) { skipped.push({ row: rowNo, reason: 'Duplicate inside the upload', value: email || clinic }); continue; }
      seen.add(key);

      let first = s(r.first_name), last = s(r.last_name);
      const full = s(r.contact_name);
      if (!first && !last && full) { const parts = full.split(/\s+/); first = parts.shift() || ''; last = parts.join(' '); }
      const hasPerson = !!(first || last);
      if (!hasPerson) { first = 'Front Desk'; last = clinic || email; }
      const city = s(r.city), prov = s(r.province_state), website = s(r.website), role = s(r.role);

      let acc: Row | null = null;
      if (clinic) {
        const list = accByName.get(clinic.toLowerCase()) ?? [];
        acc = list.find((a) => !city || !a.city || s(a.city).toLowerCase() === city.toLowerCase()) ?? null;
      }
      let con: Row | undefined = email ? conByEmail.get(email) : undefined;
      if (!con && !email && acc) {
        const accId = acc.id;
        con = cons.find((c) => c.account_id === accId && !c.email && s(c.first_name).toLowerCase() === first.toLowerCase() && s(c.last_name).toLowerCase() === last.toLowerCase());
      }

      // account
      if (clinic) {
        if (acc) {
          if (!dryRun) {
            await x(
              'update accounts set domain=coalesce(nullif($2,\'\'),domain), website=coalesce(nullif($3,\'\'),website), city=coalesce(nullif($4,\'\'),city), province_state=coalesce(nullif($5,\'\'),province_state), phone=coalesce(nullif($6,\'\'),phone), updated_at=now() where id=$1::uuid and owner_id = __UID__',
              acc.id, website ? domainOf(website) : '', website, city, prov, phone,
            );
          }
          accountsUpdated++;
        } else {
          let id = 'dry-' + i;
          if (!dryRun) {
            const ins = await q('insert into accounts (owner_id, name, domain, website, city, province_state, phone) values (__UID__, $1, nullif($2,\'\'), nullif($3,\'\'), nullif($4,\'\'), nullif($5,\'\'), nullif($6,\'\')) returning id', clinic, website ? domainOf(website) : '', website, city, prov, phone);
            id = ins[0].id;
          }
          acc = { id, name: clinic, city: city || null };
          const l = accByName.get(clinic.toLowerCase()) ?? [];
          l.push(acc);
          accByName.set(clinic.toLowerCase(), l);
          accountsCreated++;
        }
      }
      const accountId = acc && !String(acc.id).startsWith('dry-') ? acc.id : null;

      // contact
      if (con) {
        if (!dryRun) {
          await x(
            'update contacts set account_id=coalesce(account_id,$2::uuid), first_name=case when $3 then $4 else first_name end, last_name=case when $3 then $5 else last_name end, email=coalesce(nullif($6,\'\'),email), phone=coalesce(nullif($7,\'\'),phone), role=coalesce(nullif($8,\'\'),role), updated_at=now() where id=$1::uuid and owner_id = __UID__',
            con.id, accountId, hasPerson, first, last, email, phone, role,
          );
        }
        updated++;
      } else {
        if (!dryRun) {
          const ins = await q(
            'insert into contacts (owner_id, account_id, first_name, last_name, email, phone, role, source, tags) values (__UID__, $1::uuid, $2, $3, nullif($4,\'\'), nullif($5,\'\'), nullif($6,\'\'), \'Outbound\', ARRAY[\'upload\']::text[]) returning id',
            accountId, first, last, email, phone, role,
          );
          const nc = { id: ins[0].id, account_id: accountId, first_name: first, last_name: last, email: email || null };
          cons.push(nc);
          if (email) conByEmail.set(email, nc);
        }
        created++;
      }
    } catch (err) {
      skipped.push({ row: rowNo, reason: 'Database error: ' + (err instanceof Error ? err.message.slice(0, 160) : 'failed'), value: '' });
    }
  }

  if (!dryRun) {
    await x(
      'insert into import_jobs (owner_id, id, entity, file_name, total, imported, skipped, report) values (__UID__, $1,$2,$3,$4,$5,$6,$7::jsonb)',
      randomUUID(), 'leads', fileName || null, rows.length, created + updated, skipped.length, JSON.stringify({ created, updated, accountsCreated, accountsUpdated, skipped: skipped.slice(0, 200), warnings: warnings.slice(0, 200) }),
    );
  }
  return json({ dryRun, total: rows.length, created, updated, accountsCreated, accountsUpdated, skipped: skipped.slice(0, 500), skippedCount: skipped.length, warnings: warnings.slice(0, 500), warningCount: warnings.length });
}

// ---------- audience: who may receive this template ----------
type Filter = { city?: string; province_state?: string; q?: string };
type Eligible = { contactId: string; to: string; name: string; clinic: string; subject: string; html: string };
type Excluded = { contactId: string; name: string; email: string; clinic: string; reason: string };

async function audience(templateId: string, ids: string[] | null, filter: Filter) {
  const tpl = (await q('select id, name, subject, body from email_templates where id = $1 and owner_id = __UID__ limit 1', templateId))[0];
  if (!tpl) throw new Error('Template not found');
  const subjectSrc = s(tpl.subject);
  const bodySrc = s(tpl.body);
  const tokens = tokensIn(subjectSrc + ' ' + bodySrc).filter((t) => t !== 'unsubscribe_link');

  let list = await q(
    'select c.id, c.first_name, c.last_name, c.email, c.phone, c.role, c.opted_out_at, a.name as clinic, a.domain, a.website, a.city, a.province_state, a.phone as account_phone from contacts c left join accounts a on a.id = c.account_id and a.owner_id = __UID__ where c.owner_id = __UID__ order by c.created_at, c.id',
  );
  if (ids) { const want = new Set(ids); list = list.filter((c) => want.has(c.id)); }
  const fc = s(filter.city).toLowerCase(), fp = s(filter.province_state).toLowerCase(), fq = s(filter.q).toLowerCase();
  if (fc) list = list.filter((c) => s(c.city).toLowerCase() === fc);
  if (fp) list = list.filter((c) => s(c.province_state).toLowerCase() === fp);
  if (fq) list = list.filter((c) => [c.clinic, c.first_name, c.last_name, c.email, c.city].map(s).join(' ').toLowerCase().includes(fq));

  const optOuts = new Set((await q('select lower(email) as e from email_opt_outs')).map((r) => r.e));
  const logs = await q(
    'select lower(l.to_email) as e, l.status, l.sent_at, l.replied_at, l.bounced_at, l.opted_out_at, c.template_id, c.name as campaign from email_logs l left join campaigns c on c.id = l.campaign_id where l.to_email is not null and l.owner_id = __UID__',
  );
  const byEmail = new Map<string, Row[]>();
  for (const l of logs) { const a = byEmail.get(l.e) ?? []; a.push(l); byEmail.set(l.e, a); }

  const eligible: Eligible[] = [];
  const excluded: Excluded[] = [];
  const seenEmail = new Set<string>();
  const recentCut = Date.now() - RECENT_DAYS * 86400000;

  for (const c of list) {
    const email = s(c.email).toLowerCase();
    const real = s(c.first_name) !== 'Front Desk';
    const name = real ? (s(c.first_name) + ' ' + s(c.last_name)).trim() : 'Front Desk';
    const clinic = s(c.clinic);
    const skip = (reason: string) => excluded.push({ contactId: c.id, name, email, clinic, reason });
    if (!email) { skip('Missing email'); continue; }
    if (!EMAIL_RE.test(email)) { skip('Invalid email'); continue; }
    if (c.opted_out_at || optOuts.has(email)) { skip('Opted out'); continue; }
    if (seenEmail.has(email)) { skip('Duplicate email in this run'); continue; }
    const h = byEmail.get(email) ?? [];
    const same = h.find((l) => l.template_id === templateId && l.status !== 'failed');
    if (same) { skip('Already sent this template (campaign: ' + s(same.campaign) + ')'); continue; }
    if (h.some((l) => l.replied_at || l.status === 'replied')) { skip('Replied earlier - follow up manually'); continue; }
    if (h.some((l) => l.bounced_at || l.status === 'bounced')) { skip('Previously bounced'); continue; }
    if (h.some((l) => l.opted_out_at || l.status === 'opted_out')) { skip('Opted out'); continue; }
    if (h.some((l) => l.status === 'sent' && l.sent_at && new Date(l.sent_at).getTime() > recentCut)) { skip('Contacted in the last ' + RECENT_DAYS + ' days'); continue; }

    const vars: Vars = {
      clinic_name: clinic,
      company: clinic,
      contact_name: real ? name : 'there',
      first_name: real ? s(c.first_name) : 'there',
      website: s(c.website) || s(c.domain),
      city: s(c.city),
      province_state: s(c.province_state),
      phone: s(c.phone) || s(c.account_phone),
      email,
      unsubscribe_link: unsubUrl(email),
    };
    const unknown = tokens.find((t) => !VARIABLES.includes(t));
    if (unknown) { skip('Unknown variable in template: ' + unknown); continue; }
    const missing = tokens.find((t) => !s(vars[t]));
    if (missing) { skip('Missing variable: ' + missing); continue; }
    seenEmail.add(email);
    eligible.push({ contactId: c.id, to: email, name, clinic, subject: renderTemplate(subjectSrc, vars, false), html: renderTemplate(bodySrc, vars, true) });
  }
  const run = eligible.slice(0, MAX_PER_RUN);
  for (const e of eligible.slice(MAX_PER_RUN)) {
    excluded.push({ contactId: e.contactId, name: e.name, email: e.to, clinic: e.clinic, reason: 'Over the ' + MAX_PER_RUN + ' per run limit (next run)' });
  }
  return { tpl, eligible: run, excluded, totalConsidered: list.length };
}

async function preview(req: Request) {
  const b = await req.json();
  const a = await audience(s(b.templateId), null, (b.filter ?? {}) as Filter);
  return json({ template: { id: a.tpl.id, name: a.tpl.name }, limit: MAX_PER_RUN, totalConsidered: a.totalConsidered, eligible: a.eligible, excluded: a.excluded });
}

// ---------- send: manual, confirmed, max 50, one message per recipient ----------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function send(req: Request) {
  const b = await req.json();
  if (ctxStore.getStore()?.role !== 'ADMIN') return json({ error: 'Sending emails is limited to administrators.' }, 403);
  if (b.confirm !== 'SEND') return json({ error: 'Sending needs explicit confirmation' }, 400);
  // CASL safeguard: no send without a valid legal name, mailing address and an enabled unsubscribe link.
  const gate = sendReadiness();
  if (!gate.ok) return json({ error: 'Sending is blocked: ' + gate.reasons.join(' '), blocked: true, reasons: gate.reasons }, 409);
  const templateId = s(b.templateId);
  const ids: string[] = Array.isArray(b.contactIds) ? b.contactIds.map((v: unknown) => s(v)).filter(Boolean) : [];
  if (!ids.length) return json({ error: 'No recipients selected' }, 400);
  if (ids.length > MAX_PER_RUN) return json({ error: 'At most ' + MAX_PER_RUN + ' messages per run' }, 400);

  const a = await audience(templateId, ids, {});
  if (!a.eligible.length) return json({ error: 'None of the selected contacts can be emailed now', excluded: a.excluded }, 400);

  const needsProvider = a.eligible.some((e) => !isTestAddr(e.to));
  const apiKey = process.env.RESEND_API_KEY;
  if (needsProvider && !apiKey) return json({ error: 'RESEND_API_KEY is not configured. Nothing was sent.' }, 500);
  const resend = apiKey ? new Resend(apiKey) : null;

  const campaignId = randomUUID();
  const campaignName = s(b.campaignName).slice(0, 200) || (s(a.tpl.name) + ' - ' + new Date().toISOString().slice(0, 16).replace('T', ' '));
  await x(
    'insert into campaigns (owner_id, id, name, status, subject, template_id, audience, daily_limit, notes) values (__UID__, $1,$2,$3,$4,$5,$6::jsonb,$7,$8)',
    campaignId, campaignName, 'sending', s(a.tpl.subject), templateId, JSON.stringify({ contacts: a.eligible.length }), MAX_PER_RUN, 'Manual send',
  );

  const results: { to: string; status: string; error?: string }[] = [];
  let sent = 0, failed = 0, bounced = 0, duplicates = 0;
  for (const e of a.eligible) {
    const logId = randomUUID();
    const ins = await q(
      'insert into email_logs (owner_id, id, campaign_id, contact_id, to_email, subject, body, status, thread_key, prepared_at) values (__UID__, $1,$2,$3,$4,$5,$6,\'queued\',$7,now()) on conflict do nothing returning id',
      logId, campaignId, e.contactId, e.to, e.subject, e.html, e.to + '|' + templateId,
    );
    if (!ins.length) { duplicates++; results.push({ to: e.to, status: 'skipped', error: 'duplicate in this campaign' }); continue; }
    try {
      let providerId = '';
      let simulatedBounce = false;
      if (isTestAddr(e.to)) {
        const local = e.to.split('@')[0].toLowerCase();
        if (local.startsWith('fail')) throw new Error('Simulated provider failure (test address)');
        simulatedBounce = local.startsWith('bounce');
        providerId = 'simulated-' + randomUUID();
      } else {
        const res = await resend!.emails.send({
          from: FROM,
          to: e.to,
          subject: e.subject,
          html: e.html,
          text: htmlToText(e.html),
          headers: { 'List-Unsubscribe': '<' + unsubUrl(e.to) + '>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        });
        if (res.error) throw new Error(res.error.message);
        providerId = res.data?.id ?? '';
        await sleep(600);
      }
      if (simulatedBounce) {
        await x('update email_logs set status=\'bounced\', gmail_message_id=$2, sent_at=now(), bounced_at=now(), error=\'Simulated bounce (test address)\', updated_at=now() where id=$1', logId, providerId);
        bounced++;
        results.push({ to: e.to, status: 'bounced' });
      } else {
        await x('update email_logs set status=\'sent\', gmail_message_id=$2, sent_at=now(), updated_at=now() where id=$1', logId, providerId);
        await x('update contacts set last_contacted_at=now(), lead_status=case when lead_status=\'New\' then \'Contacted\' else lead_status end, updated_at=now() where id=$1::uuid and owner_id = __UID__', e.contactId);
        sent++;
        results.push({ to: e.to, status: 'sent' });
      }
    } catch (err) {
      const msg = (err instanceof Error ? err.message : 'send failed').slice(0, 500);
      await x('update email_logs set status=\'failed\', failed_at=now(), error=$2, updated_at=now() where id=$1', logId, msg);
      failed++;
      results.push({ to: e.to, status: 'failed', error: msg });
    }
  }
  await x('update campaigns set status=\'completed\', notes=$2, updated_at=now() where id=$1', campaignId, 'sent ' + sent + ', failed ' + failed + ', bounced ' + bounced + ', duplicates ' + duplicates);
  return json({ campaignId, campaignName, sent, failed, bounced, duplicates, results });
}

// ---------- one-time test-email exception (audited) ----------
// Permits exactly ONE email, ever, to TEST_TO, for any signed-in user. Fixed content; no contacts,
// templates, campaigns, schedules or other recipients. send() and its 409 CASL gate are untouched.
// The single use is claimed atomically by inserting a campaigns row with a fixed id (the audit record).
const TEST_TO = 'ibrahim.zed24@gmail.com';
const TEST_ONCE_ID = '7e57a11e-0000-4000-8000-000000000e11';
async function testOnce(req: Request) {
  const b = await req.json();
  if (b.confirm !== 'SEND_ONE_TEST' || s(b.to).toLowerCase() !== TEST_TO) {
    return json({ error: 'Only the single approved test recipient is allowed.' }, 403);
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return json({ error: 'RESEND_API_KEY is not configured. Nothing was sent.' }, 500);
  const subject = 'Sales OS test email';
  const claim = await q(
    'insert into campaigns (owner_id, id, name, status, subject, template_id, audience, daily_limit, notes) values (__UID__, $1,$2,\'sending\',$3,null,$4::jsonb,1,$5) on conflict do nothing returning id',
    TEST_ONCE_ID, 'ONE-TIME TEST EXCEPTION', subject, JSON.stringify({ contacts: 1, to: TEST_TO }), 'claimed ' + new Date().toISOString(),
  );
  if (!claim.length) return json({ error: 'The one-time test exception has already been used.', used: true }, 409);
  console.warn('send-os test-once: exception claimed by user', ctxStore.getStore()?.uid, 'to', TEST_TO);
  try {
    const res = await new Resend(apiKey).emails.send({
      from: FROM,
      to: TEST_TO,
      subject,
      text: 'This is a single test email sent from Sales OS to confirm delivery. No action is needed.',
    });
    if (res.error) throw new Error(res.error.message);
    await x('update campaigns set status=\'completed\', notes=$2, updated_at=now() where id=$1', TEST_ONCE_ID, 'sent ' + new Date().toISOString() + ' provider id ' + (res.data?.id ?? ''));
    return json({ ok: true, sent: 1, to: TEST_TO, id: res.data?.id ?? '' });
  } catch (err) {
    const msg = (err instanceof Error ? err.message : 'send failed').slice(0, 300);
    await x('update campaigns set status=\'failed\', notes=$2, updated_at=now() where id=$1', TEST_ONCE_ID, 'failed ' + new Date().toISOString() + ': ' + msg);
    return json({ ok: false, error: msg }, 502);
  }
}

// ---------- statuses, history, opt-out ----------
async function addOptOut(email: string, source: string) {
  await x('insert into email_opt_outs (email, source) values ($1,$2) on conflict (email) do nothing', email, source);
  await x('update contacts set opted_out_at=coalesce(opted_out_at, now()) where lower(email)=$1', email);
  await x('update email_logs set opted_out_at=coalesce(opted_out_at, now()) where lower(to_email)=$1', email);
}

async function setStatus(req: Request) {
  const b = await req.json();
  const status = s(b.status);
  if (!['replied', 'bounced', 'opted_out'].includes(status)) return json({ error: 'status must be replied, bounced or opted_out' }, 400);
  let email = s(b.email).toLowerCase();
  const logId = s(b.logId);
  if (logId) {
    const row = (await q('select to_email from email_logs where id=$1 and owner_id = __UID__', logId))[0];
    if (!row) return json({ error: 'Log not found' }, 404);
    email = s(row.to_email).toLowerCase();
    const col = status === 'replied' ? 'replied_at' : status === 'bounced' ? 'bounced_at' : 'opted_out_at';
    await x('update email_logs set status=$2, ' + col + '=now(), updated_at=now() where id=$1 and owner_id = __UID__', logId, status);
  }
  if (status === 'opted_out') {
    if (!EMAIL_RE.test(email)) return json({ error: 'A valid email is required' }, 400);
    await addOptOut(email, logId ? 'manual (history)' : 'manual');
  }
  return json({ ok: true, status, email });
}

async function history() {
  const logs = await q(
    'select l.id, l.campaign_id as "campaignId", c.name as "campaignName", l.to_email as "toEmail", l.subject, l.status, l.error, l.sent_at as "sentAt", l.failed_at as "failedAt", l.bounced_at as "bouncedAt", l.replied_at as "repliedAt", l.opted_out_at as "optedOutAt", l.created_at as "createdAt" from email_logs l left join campaigns c on c.id = l.campaign_id where l.owner_id = __UID__ order by l.created_at desc limit 300',
  );
  const counts = await q('select status, count(*)::int as n from email_logs where owner_id = __UID__ group by status');
  const optOuts = (await q('select count(*)::int as n from email_opt_outs o where exists (select 1 from contacts c where c.owner_id = __UID__ and lower(c.email) = o.email)'))[0]?.n ?? 0;
  return json({ logs, counts, optOuts });
}

async function unsub(req: Request) {
  const u = new URL(req.url);
  const email = s(u.searchParams.get('e')).toLowerCase();
  const tok = s(u.searchParams.get('t'));
  const want = EMAIL_RE.test(email) ? unsubToken(email) : '';
  let ok = false;
  try { ok = !!want && tok.length === want.length && timingSafeEqual(Buffer.from(tok), Buffer.from(want)); } catch { ok = false; }
  const page = (msg: string, status: number) => new NextResponse('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font-family:system-ui;max-width:480px;margin:15vh auto;padding:0 16px"><h2>' + msg + '</h2></body>', { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
  if (!ok) return page('This unsubscribe link is not valid.', 400);
  await addOptOut(email, 'unsubscribe link');
  return page('You have been unsubscribed. You will not receive further emails from us.', 200);
}
