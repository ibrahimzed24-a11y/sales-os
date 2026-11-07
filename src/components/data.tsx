'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn, download, toCSV, parseCSV } from '@/lib/utils';
import { Button, inputCls, Modal } from '@/components/ui';
import { dbCall } from '@/lib/api';
import { refreshDirectory } from '@/lib/store';
import { REPS } from '@/components/forms';

export function useDebounced<T>(v: T, ms = 350): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export function useList<T>(table: string, params: Record<string, string>, extra: unknown[] = []) {
  const [state, setState] = useState({ rows: [] as T[], total: 0, loading: true, error: '' });
  const [tick, setTick] = useState(0);
  const seq = useRef(0);
  const key = JSON.stringify(params);
  useEffect(() => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true }));
    dbCall<{ rows: T[]; total: number }>('GET', '/api/db/' + table + '?' + new URLSearchParams(JSON.parse(key) as Record<string, string>).toString())
      .then((r) => { if (id === seq.current) setState({ rows: r.rows, total: r.total, loading: false, error: '' }); })
      .catch((e: Error) => { if (id === seq.current) setState((s) => ({ ...s, loading: false, error: e.message })); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, key, tick, ...extra]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

export function Pager({ page, pageSize, total, onPage, onSize }: { page: number; pageSize: number; total: number; onPage: (p: number) => void; onSize: (n: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-xs text-muted">
      <span>{total === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(total, page * pageSize)} of {total.toLocaleString()}</span>
      <div className="flex items-center gap-2">
        <select className={cn(inputCls, 'w-28')} value={pageSize} onChange={(e) => onSize(Number(e.target.value))}>
          {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n} / page</option>)}
        </select>
        <Button variant="outline" disabled={page <= 1} onClick={() => onPage(1)}>First</Button>
        <Button variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</Button>
        <span>Page {page} / {pages}</span>
        <Button variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
        <Button variant="outline" disabled={page >= pages} onClick={() => onPage(pages)}>Last</Button>
      </div>
    </div>
  );
}

export function renderTpl(s: string, c: { firstName?: string; lastName?: string; role?: string; email?: string }, company: string): string {
  const m: Record<string, string> = {
    first_name: c.firstName ?? '', last_name: c.lastName ?? '', full_name: ((c.firstName ?? '') + ' ' + (c.lastName ?? '')).trim(),
    company, role: c.role ?? '', email: c.email ?? '',
  };
  return s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => m[k] ?? '');
}

export const DEFAULT_SENDER = 'sales@health.valioz.com';
const WEBMAIL_URL = 'https://webmail.hostinger.com/';

// Reads SENDER_EMAIL (Vercel env) through /api/sender; falls back to the official address.
export function useSender(): string {
  const [sender, setSender] = useState(DEFAULT_SENDER);
  useEffect(() => {
    fetch('/api/sender').then((r) => r.json()).then((j: { senderEmail?: string }) => { if (j.senderEmail) setSender(j.senderEmail); }).catch(() => undefined);
  }, []);
  return sender;
}

// Manual sending: opens a compose window in Hostinger Webmail (sign in to the sales mailbox there).
export function webmailLink(to: string, subject: string, body: string): string {
  return WEBMAIL_URL + '?_task=mail&_action=compose&_to=' + encodeURIComponent(to) + '&_subject=' + encodeURIComponent(subject) + '&_body=' + encodeURIComponent(body);
}

type Field = { key: string; label: string; aliases: string[] };
const CONTACT_FIELDS: Field[] = [
  { key: 'firstName', label: 'First name', aliases: ['firstname', 'first', 'givenname', 'forename', 'fname'] },
  { key: 'lastName', label: 'Last name', aliases: ['lastname', 'last', 'surname', 'familyname', 'lname'] },
  { key: 'fullName', label: 'Full name (split automatically)', aliases: ['name', 'fullname', 'contactname', 'contact'] },
  { key: 'email', label: 'Email', aliases: ['email', 'emailaddress', 'mail', 'workemail', 'businessemail'] },
  { key: 'phone', label: 'Phone', aliases: ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'telephone', 'tel', 'cell', 'whatsapp'] },
  { key: 'role', label: 'Job title', aliases: ['role', 'title', 'jobtitle', 'position', 'designation'] },
  { key: 'company', label: 'Company (links to Account)', aliases: ['company', 'companyname', 'account', 'accountname', 'organization', 'organisation', 'employer', 'business'] },
  { key: 'leadStatus', label: 'Status', aliases: ['leadstatus', 'status', 'stage'] },
  { key: 'leadScore', label: 'Score', aliases: ['leadscore', 'score'] },
  { key: 'source', label: 'Source', aliases: ['source', 'leadsource', 'channel'] },
  { key: 'tags', label: 'Tags', aliases: ['tags', 'tag', 'labels', 'list'] },
  { key: 'owner', label: 'Owner', aliases: ['owner', 'assignedto', 'rep', 'salesrep'] },
];
const ACCOUNT_FIELDS: Field[] = [
  { key: 'name', label: 'Company name', aliases: ['name', 'accountname', 'company', 'companyname', 'account', 'organization', 'organisation'] },
  { key: 'domain', label: 'Website / domain', aliases: ['domain', 'website', 'url', 'site', 'web'] },
  { key: 'industry', label: 'Industry', aliases: ['industry', 'sector', 'vertical'] },
  { key: 'size', label: 'Employees', aliases: ['size', 'employees', 'headcount', 'numberofemployees', 'employeecount'] },
  { key: 'annualRevenue', label: 'Annual revenue', aliases: ['annualrevenue', 'revenue', 'arr'] },
  { key: 'tier', label: 'Tier', aliases: ['tier', 'segment'] },
];

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

function detect(fields: Field[], head: string[]): Record<string, number> {
  const used = new Set<number>();
  const out: Record<string, number> = {};
  const hs = head.map(norm);
  for (const f of fields) {
    let i = hs.findIndex((h, idx) => !used.has(idx) && f.aliases.includes(h));
    if (i < 0) i = hs.findIndex((h, idx) => !used.has(idx) && f.aliases.some((a) => a.length > 3 && h.startsWith(a)));
    out[f.key] = i;
    if (i >= 0) used.add(i);
  }
  return out;
}

type Skip = { row: number; reason: string; value: string };
type Result = { total: number; imported: number; skipped: Skip[]; created: number; linked: number; stopped: boolean };

export function ImportWizard({ entity, onClose, onDone }: { entity: 'contacts' | 'accounts'; onClose: () => void; onDone: () => void }) {
  const fields = entity === 'contacts' ? CONTACT_FIELDS : ACCOUNT_FIELDS;
  const [fileName, setFileName] = useState('');
  const [table, setTable] = useState<string[][] | null>(null);
  const [map, setMap] = useState<Record<string, number>>({});
  const [phase, setPhase] = useState<'map' | 'run' | 'done'>('map');
  const [prog, setProg] = useState({ done: 0, total: 0 });
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState('');
  const stop = useRef(false);

  const load = async (f: File) => {
    const text = (await f.text()).replace(/^﻿/, '');
    const first = text.split(/\r?\n/, 1)[0] ?? '';
    const delim = [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
    const t = parseCSV(text, delim);
    if (t.length < 2) { setErr('The file needs a header row and at least one data row.'); return; }
    setErr(''); setFileName(f.name); setTable(t); setMap(detect(fields, t[0]));
  };

  const rec = (cells: string[]): Record<string, string> => {
    const o: Record<string, string> = {};
    for (const f of fields) o[f.key] = (map[f.key] ?? -1) >= 0 ? (cells[map[f.key]] ?? '').trim() : '';
    if (entity === 'contacts') {
      if (!o.firstName && !o.lastName && o.fullName) { const p = o.fullName.split(/\s+/); o.firstName = p[0]; o.lastName = p.slice(1).join(' '); }
      if (!o.owner) o.owner = REPS[0];
    }
    return o;
  };
  const keyOf = (o: Record<string, string>) => {
    if (entity !== 'contacts') return o.name.toLowerCase();
    const d = o.phone.replace(/\D/g, '');
    return o.email.toLowerCase() || (d.length >= 7 ? 'p:' + d : '');
  };

  const stats = useMemo(() => {
    if (!table) return null;
    let missing = 0, bad = 0, dup = 0;
    const seen = new Set<string>();
    for (const cells of table.slice(1)) {
      const o = rec(cells);
      const k = keyOf(o);
      if (!k) missing++;
      else if (seen.has(k)) dup++;
      else seen.add(k);
      if (entity === 'contacts' && o.email && !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(o.email)) bad++;
    }
    return { rows: table.length - 1, missing, bad, dup };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, map]);

  const run = async () => {
    if (!table) return;
    stop.current = false;
    setPhase('run');
    const skipped: Skip[] = [];
    const rows: Record<string, string | number>[] = [];
    const seen = new Set<string>();
    table.slice(1).forEach((cells, i) => {
      const o = rec(cells);
      const k = keyOf(o);
      if (k && seen.has(k)) { skipped.push({ row: i + 2, reason: 'Duplicate inside file / مكرر داخل الملف', value: k }); return; }
      if (k) seen.add(k);
      rows.push({ ...o, row: i + 2 });
    });
    let imported = 0, created = 0, linked = 0;
    setProg({ done: 0, total: rows.length });
    for (let i = 0; i < rows.length; i += 100) {
      if (stop.current) break;
      const b = rows.slice(i, i + 100);
      try {
        const r = await dbCall<{ imported: number; skipped: Skip[]; accountsCreated: number; linked: number }>('POST', '/api/import', { entity, rows: b });
        imported += r.imported; created += r.accountsCreated; linked += r.linked; skipped.push(...r.skipped);
      } catch (e) {
        b.forEach((x) => skipped.push({ row: Number(x.row), reason: 'Server error: ' + (e instanceof Error ? e.message : 'failed'), value: '' }));
      }
      setProg({ done: Math.min(i + 100, rows.length), total: rows.length });
    }
    skipped.sort((a, b) => a.row - b.row);
    const result = { total: table.length - 1, imported, skipped, created, linked, stopped: stop.current };
    const reasons: Record<string, number> = {};
    skipped.forEach((s) => { reasons[s.reason] = (reasons[s.reason] ?? 0) + 1; });
    await dbCall('POST', '/api/import', { kind: 'job', entity, fileName, total: result.total, imported, skipped: skipped.length, report: { reasons, accountsCreated: created, contactsLinked: linked, skippedRows: skipped.slice(0, 2000) } }).catch(() => undefined);
    setRes(result);
    setPhase('done');
    onDone();
    void refreshDirectory();
  };

  const reasons = useMemo(() => {
    const m: Record<string, number> = {};
    (res?.skipped ?? []).forEach((s) => { m[s.reason] = (m[s.reason] ?? 0) + 1; });
    return Object.entries(m);
  }, [res]);

  return (
    <Modal title={'Import ' + entity + ' from CSV'} onClose={phase === 'run' ? () => undefined : onClose} wide>
      {phase === 'map' && (
        <div className="space-y-3 text-sm">
          <input type="file" accept=".csv,.tsv,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) void load(f); }} />
          {err && <p className="text-red-400">{err}</p>}
          {table && stats && (
            <>
              <p className="text-muted">{fileName}: {stats.rows.toLocaleString()} rows. Columns were detected automatically, adjust if needed.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {fields.map((f) => (
                  <label key={f.key} className="flex items-center justify-between gap-2">
                    <span>{f.label}</span>
                    <select className={cn(inputCls, 'w-48')} value={map[f.key] ?? -1} onChange={(e) => setMap({ ...map, [f.key]: Number(e.target.value) })}>
                      <option value={-1}>- not mapped -</option>
                      {table[0].map((h, i) => <option key={i} value={i}>{h || 'Column ' + (i + 1)} ({(table[1][i] ?? '').slice(0, 18)})</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <p className="rounded border border-line p-2 text-xs">
                Validation preview: {stats.rows - stats.missing - stats.dup - stats.bad} look valid, {stats.missing} without {entity === 'contacts' ? 'email/phone' : 'name'}, {stats.bad} invalid emails, {stats.dup} duplicates inside the file. Rows already in the database are skipped during import.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button onClick={() => void run()}>Start import</Button>
              </div>
            </>
          )}
        </div>
      )}
      {phase === 'run' && (
        <div className="space-y-3 text-sm">
          <p>Importing {prog.done.toLocaleString()} / {prog.total.toLocaleString()} rows...</p>
          <div className="h-2 rounded bg-raised"><div className="h-2 rounded bg-brand" style={{ width: (prog.total ? (prog.done / prog.total) * 100 : 0) + '%' }} /></div>
          <Button variant="outline" onClick={() => { stop.current = true; }}>Stop after this batch</Button>
        </div>
      )}
      {phase === 'done' && res && (
        <div className="space-y-3 text-sm">
          <p className="font-medium">{res.stopped ? 'Import stopped. ' : 'Import finished. '}Imported {res.imported.toLocaleString()} of {res.total.toLocaleString()} rows, skipped {res.skipped.length.toLocaleString()}.</p>
          {entity === 'contacts' && <p className="text-muted">Contacts linked to accounts: {res.linked}. New accounts created: {res.created}.</p>}
          {reasons.length > 0 && (
            <table className="w-full text-xs">
              <tbody>{reasons.map(([r, n]) => <tr key={r} className="border-t border-line"><td className="py-1">{r}</td><td className="py-1 text-right">{n}</td></tr>)}</tbody>
            </table>
          )}
          {res.skipped.length > 0 && (
            <>
              <ul className="max-h-40 overflow-y-auto text-xs text-muted">
                {res.skipped.slice(0, 50).map((s, i) => <li key={i}>Row {s.row}: {s.reason} {s.value}</li>)}
              </ul>
              <Button variant="outline" onClick={() => download('skipped-rows.csv', toCSV(res.skipped.map((s) => ({ row: s.row, reason: s.reason, value: s.value }))), 'text/csv')}>Download skipped rows</Button>
            </>
          )}
          <div className="flex justify-end"><Button onClick={onClose}>Close</Button></div>
        </div>
      )}
    </Modal>
  );
}
