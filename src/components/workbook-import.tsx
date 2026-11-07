'use client';

import { useMemo, useState } from 'react';
import { cn, download, toCSV, parseCSV } from '@/lib/utils';
import { inputCls, Modal } from '@/components/ui';
import { dbCall } from '@/lib/api';
import { refreshDirectory } from '@/lib/store';

// Lead file import: .xlsx / .xls / .csv -> sheet picker -> header row -> column mapping -> dry run -> import.
type Sheet = { name: string; rows: string[][]; rowNos: number[]; blank: number; truncated: boolean };
type Cell = { t?: string; v?: unknown; z?: unknown };
type Issue = { row: number; status: string; reason: string; value: string };
type Totals = { total: number; created: number; updated: number; skipped: number; duplicate: number; invalid: number; failed: number; accountsCreated: number; accountsUpdated: number; contactsCreated: number; contactsUpdated: number };
const MAX_BYTES = 10 * 1024 * 1024, MAX_ROWS = 20000, MAX_COLS = 200;

const isDateFmt = (f: string) => { const x = f.replace(/"[^"]*"|\\.|\[[^\]]*\]/g, ''); return !/^general$/i.test(x) && /[ymdhs]/i.test(x); };
const two = (n: number) => String(n).padStart(2, '0');

function cellText(XLSX: typeof import('xlsx'), c: Cell | undefined, date1904: boolean): string {
  if (!c || c.v == null || c.t === 'e') return '';
  if (c.t === 'b') return c.v ? 'TRUE' : 'FALSE';
  if (c.v instanceof Date) return c.v.toISOString().slice(0, 10);
  if (typeof c.v === 'number') {
    const v = c.v;
    if (!Number.isFinite(v)) return '';
    if (typeof c.z === 'string' && isDateFmt(c.z) && v >= 0) {
      const ssf = XLSX.SSF as unknown as { parse_date_code: (v: number, o?: { date1904?: boolean }) => { y: number; m: number; d: number; H: number; M: number; S: number } | null };
      const p = ssf.parse_date_code(v, { date1904 });
      if (p) {
        const time = two(p.H) + ':' + two(p.M) + ':' + two(Math.floor(p.S));
        if (v < 1) return time;
        const day = String(p.y).padStart(4, '0') + '-' + two(p.m) + '-' + two(p.d);
        return p.H || p.M || p.S ? day + ' ' + time : day;
      }
    }
    return String(v);
  }
  return String(c.v).replace(/\u0000/g, '').trim();
}

async function readFile(f: File): Promise<Sheet[]> {
  const lower = f.name.toLowerCase();
  if (f.size === 0) throw new Error('The file is empty.');
  if (f.size > MAX_BYTES) throw new Error('The file is larger than 10 MB. Split it into smaller files.');
  if (/\.(csv|tsv|txt)$/.test(lower)) {
    const text = (await f.text()).replace(/^﻿/, '');
    const first = text.split(/\r?\n/, 1)[0] ?? '';
    const delim = [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
    const all = parseCSV(text, delim).map((r) => r.map((c) => (c ?? '').trim()));
    const rows: string[][] = [], rowNos: number[] = [];
    all.forEach((r, i) => { if (r.some((c) => c !== '')) { rows.push(r); rowNos.push(i + 1); } });
    return [{ name: 'CSV', rows, rowNos, blank: all.length - rows.length, truncated: false }];
  }
  if (!/\.(xlsx|xlsm|xls)$/.test(lower)) throw new Error('Unsupported file type. Choose an .xlsx, .xls or .csv file.');
  const buf = new Uint8Array(await f.arrayBuffer());
  const zip = buf[0] === 0x50 && buf[1] === 0x4b, cfb = buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0;
  if (!zip && !cfb) throw new Error('This file is not a real Excel workbook (it may be renamed, damaged or exported as HTML). Open it in Excel and save it again as .xlsx.');
  const XLSX = await import('xlsx');
  let wb: import('xlsx').WorkBook;
  try { wb = XLSX.read(buf, { type: 'array', cellNF: true, cellDates: false }); }
  catch (e) {
    const m = e instanceof Error ? e.message : '';
    throw new Error(/password|encrypt/i.test(m) ? 'The workbook is password protected. Remove the password in Excel and upload it again.' : 'The workbook could not be read (' + m.slice(0, 120) + '). Save it again as .xlsx and retry.');
  }
  if (!wb.SheetNames.length) throw new Error('The workbook has no sheets.');
  const date1904 = !!wb.Workbook?.WBProps?.date1904;
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name] as unknown as Record<string, Cell> & { '!ref'?: string };
    if (!ws || !ws['!ref']) return { name, rows: [], rowNos: [], blank: 0, truncated: false };
    const rg = XLSX.utils.decode_range(ws['!ref']);
    const lastR = Math.min(rg.e.r, rg.s.r + MAX_ROWS), lastC = Math.min(rg.e.c, rg.s.c + MAX_COLS - 1);
    const rows: string[][] = [], rowNos: number[] = [];
    let blank = 0, width = 0;
    for (let r = rg.s.r; r <= lastR; r++) {
      const cells: string[] = [];
      for (let c = rg.s.c; c <= lastC; c++) cells.push(cellText(XLSX, ws[XLSX.utils.encode_cell({ r, c })], date1904));
      const lastFilled = cells.reduce((m, v, i) => (v !== '' ? i : m), -1);
      if (lastFilled < 0) { blank++; continue; }
      width = Math.max(width, lastFilled + 1);
      rows.push(cells); rowNos.push(r + 1);
    }
    return { name, rows: rows.map((r) => r.slice(0, width)), rowNos, blank, truncated: rg.e.r > lastR };
  });
}

// Header = the earliest row (of the first 20) that looks most like a header: many distinct text cells.
function detectHeader(rows: string[][]): number {
  const scores = rows.slice(0, 20).map((r, i) => {
    const f = r.filter((c) => c !== '');
    if (f.length < 2 || i === rows.length - 1) return -1;
    const text = f.filter((c) => /[A-Za-z؀-ۿ]/.test(c) && !/^[\d\s.,:/-]+$/.test(c) && c.length <= 60).length;
    return text * 2 + new Set(f.map((c) => c.toLowerCase())).size;
  });
  const max = Math.max(...scores, -1);
  return max <= 0 ? -1 : scores.findIndex((v) => v >= max * 0.8);
}
function headersOf(r: string[], width: number): string[] {
  const seen = new Map<string, number>();
  return Array.from({ length: width }, (_, i) => {
    const h = (r[i] ?? '').trim() || 'Column ' + (i + 1);
    const n = (seen.get(h.toLowerCase()) ?? 0) + 1; seen.set(h.toLowerCase(), n);
    return n > 1 ? h + ' (' + n + ')' : h;
  });
}

type Field = { key: string; label: string; aliases: string[]; custom?: string };
const FIELDS: Field[] = [
  { key: 'clinic', label: 'Clinic / account name', aliases: ['clinicbrandname', 'clinicname', 'clinic', 'company', 'companyname', 'accountname', 'account', 'practicename', 'practice', 'businessname', 'organization', 'organisation', 'name'] },
  { key: 'parent', label: 'Parent account / group', aliases: ['parentdso', 'parentaccount', 'parentcompany', 'parent', 'group', 'dso'], custom: 'parent_account' },
  { key: 'contact', label: 'Contact name', aliases: ['contactname', 'contact', 'officemanagername', 'officemanager', 'fullname', 'person'] },
  { key: 'contactAlt', label: 'Contact fallback 1', aliases: ['principaldentists', 'principaldentist', 'dentist'] },
  { key: 'contactAlt2', label: 'Contact fallback 2', aliases: ['associatedentists', 'associatedentist'] },
  { key: 'frontDesk', label: 'Front desk', aliases: ['frontdesk', 'frontdeskname', 'frontdeskcontact', 'reception', 'receptionist'] },
  { key: 'email', label: 'Email', aliases: ['email', 'clinicemail', 'emailaddress', 'mail', 'contactemail', 'workemail'] },
  { key: 'phone', label: 'Phone', aliases: ['phone', 'phonenumber', 'clinicphone', 'telephone', 'tel', 'mobile', 'cell'] },
  { key: 'address', label: 'Street address', aliases: ['streetaddress', 'address', 'address1', 'street', 'addressline1'], custom: 'address' },
  { key: 'address2', label: 'Suite / unit', aliases: ['suiteunit', 'suite', 'unit', 'address2', 'addressline2'], custom: 'suite_unit' },
  { key: 'city', label: 'City', aliases: ['city', 'town'] },
  { key: 'province', label: 'Province / state', aliases: ['provincestate', 'province', 'state', 'region'] },
  { key: 'postal', label: 'Postal / ZIP code', aliases: ['postalcode', 'postal', 'zip', 'zipcode', 'postcode'], custom: 'postal_code' },
  { key: 'website', label: 'Website', aliases: ['directclinicurl', 'website', 'url', 'site', 'web', 'domain', 'clinicurl'] },
  { key: 'role', label: 'Job title', aliases: ['role', 'title', 'jobtitle', 'position'] },
  { key: 'placeId', label: 'Google place ID (duplicate check)', aliases: ['googleplaceid', 'placeid'], custom: 'google_place_id' },
];
const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');
function autoMap(head: string[]): Record<string, number> {
  const used = new Set<number>(), out: Record<string, number> = {}, hs = head.map(norm);
  for (const f of FIELDS) {
    let i = -1;
    for (const a of f.aliases) { i = hs.findIndex((h, idx) => !used.has(idx) && h === a); if (i >= 0) break; }
    out[f.key] = i; if (i >= 0) used.add(i);
  }
  return out;
}

export function WorkbookImport({ entity, onClose, onDone }: { entity: 'contacts' | 'accounts'; onClose: () => void; onDone: () => void }) {
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [si, setSi] = useState(0);
  const [hdr, setHdr] = useState(0);
  const [map, setMap] = useState<Record<string, number>>({});
  const [withContacts, setWithContacts] = useState(entity === 'contacts');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [prog, setProg] = useState('');
  const [res, setRes] = useState<{ dry: boolean; t: Totals; issues: Issue[]; warnings: Issue[]; sig: string } | null>(null);

  const sheet = sheets[si];
  const pickSheet = (list: Sheet[], i: number) => {
    setSi(i); setRes(null);
    const h = detectHeader(list[i]?.rows ?? []);
    setHdr(Math.max(0, h));
    const width = Math.max(0, ...(list[i]?.rows ?? []).map((r) => r.length));
    setMap(h >= 0 ? autoMap(headersOf(list[i].rows[h], width)) : {});
    setErr(!list[i]?.rows.length ? 'Sheet "' + (list[i]?.name ?? '') + '" is empty. Pick another sheet.' : h < 0 ? 'No header row was found in "' + list[i].name + '". The first row needs column names (e.g. clinic name, email, phone).' : '');
  };
  const load = async (f: File) => {
    setErr(''); setRes(null); setSheets([]); setBusy('read');
    try {
      const list = await readFile(f);
      setFileName(f.name); setSheets(list);
      const best = list.findIndex((s) => s.rows.length > 1);
      if (best < 0) { setErr('No sheet in this file has a header row and data rows.'); return; }
      pickSheet(list, best);
    } catch (e) { setErr(e instanceof Error ? e.message : 'The file could not be read.'); }
    finally { setBusy(''); }
  };

  const width = useMemo(() => Math.max(0, ...(sheet?.rows ?? []).map((r) => r.length)), [sheet]);
  const head = useMemo(() => (sheet && sheet.rows[hdr] ? headersOf(sheet.rows[hdr], width) : []), [sheet, hdr, width]);
  const data = useMemo(() => (sheet ? sheet.rows.slice(hdr + 1).map((cells, i) => ({ cells, row: sheet.rowNos[hdr + 1 + i] })) : []), [sheet, hdr]);
  const sig = JSON.stringify([fileName, si, hdr, map, withContacts]);

  const build = () => {
    const col = (cells: string[], k: string) => ((map[k] ?? -1) >= 0 ? (cells[map[k]] ?? '').trim() : '');
    const mappedCore = new Set(FIELDS.filter((f) => !f.custom && !['contactAlt', 'contactAlt2'].includes(f.key)).map((f) => map[f.key]).filter((i) => i >= 0));
    const out: Record<string, unknown>[] = [], local: Issue[] = [];
    const seen = new Set<string>();
    for (const { cells, row } of data) {
      const custom: Record<string, string> = {};
      head.forEach((h, i) => { const v = (cells[i] ?? '').trim(); if (v && !mappedCore.has(i)) custom[h] = v; });
      for (const f of FIELDS) if (f.custom) { const v = col(cells, f.key); if (v) custom[f.custom] = v; }
      const r = { row, clinic: col(cells, 'clinic'), email: col(cells, 'email').toLowerCase(), phone: col(cells, 'phone'), city: col(cells, 'city'), province: col(cells, 'province'), website: col(cells, 'website'), role: col(cells, 'role'), frontDesk: col(cells, 'frontDesk'), contact: col(cells, 'contact') || col(cells, 'contactAlt') || col(cells, 'contactAlt2'), custom };
      const key = withContacts && r.email ? 'e:' + r.email : 'c:' + (custom.google_place_id || r.clinic.toLowerCase() + '|' + r.city.toLowerCase()) + (withContacts ? '|' + r.contact.toLowerCase() + '|' + r.phone.replace(/\D/g, '') : '');
      if ((r.clinic || r.email) && seen.has(key)) { local.push({ row, status: 'duplicate', reason: 'Duplicate inside the file', value: r.email || r.clinic }); continue; }
      seen.add(key); out.push(r);
    }
    return { out, local };
  };

  const run = async (dry: boolean) => {
    if ((map.clinic ?? -1) < 0 && !(withContacts && (map.email ?? -1) >= 0)) { setErr('Map the clinic / account name column' + (withContacts ? ' or the email column' : '') + ' first.'); return; }
    setErr(''); setBusy(dry ? 'check' : 'import');
    const { out, local } = build();
    const t: Totals = { total: data.length, created: 0, updated: 0, skipped: 0, duplicate: local.length, invalid: 0, failed: 0, accountsCreated: 0, accountsUpdated: 0, contactsCreated: 0, contactsUpdated: 0 };
    const issues: Issue[] = [...local], warnings: Issue[] = [];
    try {
      for (let i = 0; i < out.length; i += 200) {
        setProg((dry ? 'Checking ' : 'Importing ') + Math.min(i + 200, out.length) + ' / ' + out.length);
        const chunk = out.slice(i, i + 200);
        try {
          const r = await dbCall<Totals & { issues: Issue[]; warnings: Issue[] }>('POST', '/api/import/workbook', { rows: chunk, dryRun: dry, createContacts: withContacts }, { silent: true });
          (['created', 'updated', 'skipped', 'invalid', 'failed', 'accountsCreated', 'accountsUpdated', 'contactsCreated', 'contactsUpdated'] as const).forEach((k) => { t[k] += r[k] ?? 0; });
          issues.push(...r.issues); warnings.push(...r.warnings);
        } catch (e) {
          t.failed += chunk.length;
          chunk.forEach((x) => issues.push({ row: Number(x.row), status: 'failed', reason: 'Server error: ' + (e instanceof Error ? e.message : 'failed'), value: '' }));
        }
      }
      issues.sort((a, b) => a.row - b.row);
      setRes({ dry, t, issues, warnings, sig });
      if (!dry) {
        await dbCall('POST', '/api/import', { kind: 'job', entity: 'workbook', fileName: fileName + ' [' + sheet.name + ']', total: t.total, imported: t.created + t.updated, skipped: t.total - t.created - t.updated, report: { ...t, issues: issues.slice(0, 1000), warnings: warnings.slice(0, 500) } }, { silent: true }).catch(() => undefined);
        onDone(); void refreshDirectory();
      }
    } finally { setBusy(''); setProg(''); }
  };

  const btn = 'rounded-md px-3 py-1.5 text-sm disabled:opacity-50';
  const checked = res && res.dry && res.sig === sig && res.t.failed === 0;
  return (
    <Modal title="Import leads (Excel or CSV)" onClose={busy === 'import' ? () => undefined : onClose} wide>
      <div className="space-y-3 text-sm" data-testid="workbook-import">
        <input type="file" accept=".xlsx,.xls,.xlsm,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" data-testid="workbook-file" disabled={!!busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void load(f); }} />
        {busy === 'read' && <p className="text-muted">Reading file...</p>}
        {err && <p className="rounded border border-red-500/40 p-2 text-red-400" role="alert">{err}</p>}
        {sheets.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">Sheet
              <select data-testid="sheet-select" className={cn(inputCls, 'w-56')} value={si} onChange={(e) => pickSheet(sheets, Number(e.target.value))}>
                {sheets.map((s, i) => <option key={i} value={i}>{s.name} ({Math.max(0, s.rows.length - 1)} rows)</option>)}
              </select>
            </label>
            {sheet && sheet.rows.length > 0 && (
              <label className="flex items-center gap-2">Header row
                <select className={cn(inputCls, 'w-28')} value={hdr} onChange={(e) => { const h = Number(e.target.value); setHdr(h); setMap(autoMap(headersOf(sheet.rows[h], width))); setRes(null); }}>
                  {sheet.rows.slice(0, 20).map((_, i) => <option key={i} value={i}>Row {sheet.rowNos[i]}</option>)}
                </select>
              </label>
            )}
            <label className="flex items-center gap-2"><input type="checkbox" checked={withContacts} onChange={(e) => setWithContacts(e.target.checked)} /> Also create / update contacts</label>
          </div>
        )}
        {sheet && head.length > 0 && (
          <>
            <p className="text-muted">{fileName} - sheet {'"' + sheet.name + '"'}: {data.length} data rows, {head.length} columns{sheet.blank ? ', ' + sheet.blank + ' blank rows ignored' : ''}{sheet.truncated ? ', only the first ' + MAX_ROWS + ' rows were read' : ''}.</p>
            <div className="max-h-48 overflow-auto rounded border border-line">
              <table className="w-full text-xs"><thead><tr>{head.map((h, i) => <th key={i} className="whitespace-nowrap px-2 py-1 text-left">{h}</th>)}</tr></thead>
                <tbody>{data.slice(0, 5).map((d) => <tr key={d.row} className="border-t border-line">{head.map((_, i) => <td key={i} className="max-w-[160px] truncate px-2 py-1">{d.cells[i] ?? ''}</td>)}</tr>)}</tbody></table>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <label key={f.key} className="flex items-center justify-between gap-2">
                  <span>{f.label}</span>
                  <select className={cn(inputCls, 'w-52')} value={map[f.key] ?? -1} onChange={(e) => { setMap({ ...map, [f.key]: Number(e.target.value) }); }}>
                    <option value={-1}>- not mapped -</option>
                    {head.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted">Every column you do not map is kept as custom data on the account and contact. Existing values are never overwritten; only empty fields are filled.</p>
            <div className="flex flex-wrap justify-end gap-2">
              <button className={cn(btn, 'border border-line')} onClick={onClose} disabled={busy === 'import'}>Close</button>
              <button data-testid="dry-run" className={cn(btn, 'border border-line')} disabled={!!busy} onClick={() => void run(true)}>{busy === 'check' ? prog || 'Checking...' : '1. Check (dry run)'}</button>
              <button data-testid="do-import" className={cn(btn, 'bg-brand text-white')} disabled={!!busy || !checked} onClick={() => void run(false)}>{busy === 'import' ? prog || 'Importing...' : '2. Import'}</button>
            </div>
          </>
        )}
        {res && (
          <div className="space-y-2 rounded border border-line p-3" data-testid="import-summary">
            <p className="font-medium">{res.dry ? 'Dry run - nothing was saved.' : 'Import finished.'} {res.t.total} rows</p>
            <table className="w-full text-xs"><tbody>
              {(['created', 'updated', 'skipped', 'duplicate', 'invalid', 'failed'] as const).map((k) => <tr key={k} className="border-t border-line"><td className="py-1 capitalize">{k}</td><td className="py-1 text-right">{res.t[k]}</td></tr>)}
              <tr className="border-t border-line"><td className="py-1">Accounts created / updated</td><td className="py-1 text-right">{res.t.accountsCreated} / {res.t.accountsUpdated}</td></tr>
              {withContacts && <tr className="border-t border-line"><td className="py-1">Contacts created / updated</td><td className="py-1 text-right">{res.t.contactsCreated} / {res.t.contactsUpdated}</td></tr>}
              {res.warnings.length > 0 && <tr className="border-t border-line"><td className="py-1">Warnings (bad emails)</td><td className="py-1 text-right">{res.warnings.length}</td></tr>}
            </tbody></table>
            {res.issues.length + res.warnings.length > 0 && (
              <>
                <ul className="max-h-32 overflow-y-auto text-xs text-muted">{[...res.issues, ...res.warnings].slice(0, 50).map((s, i) => <li key={i}>Row {s.row}: {s.status} - {s.reason} {s.value}</li>)}</ul>
                <button className={cn(btn, 'border border-line')} onClick={() => download('import-issues.csv', toCSV([...res.issues, ...res.warnings].map((s) => ({ row: s.row, status: s.status, reason: s.reason, value: s.value }))), 'text/csv')}>Download row report</button>
              </>
            )}
            {res.dry && res.t.failed > 0 && <p className="text-red-400">Fix the failed rows before importing.</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}
