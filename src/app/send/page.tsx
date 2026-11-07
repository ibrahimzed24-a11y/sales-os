'use client';

import { useCallback, useEffect, useState } from 'react';
import { readLeadFile, readZip, type Sheet } from '@/lib/files-client';
import { MAX_PER_RUN, VARIABLES, categoryFromFile, subjectFromHtml, tokensIn } from '@/lib/campaign';

type Tpl = { id: string; name: string; subject: string; body: string; category: string | null; variables: string[] | null; sourceFile: string | null };
type Elig = { contactId: string; to: string; name: string; clinic: string; subject: string; html: string };
type Excl = { contactId: string; name: string; email: string; clinic: string; reason: string };
type Log = { id: string; campaignName: string | null; toEmail: string; subject: string; status: string; error: string | null; sentAt: string | null; failedAt: string | null; bouncedAt: string | null; repliedAt: string | null; optedOutAt: string | null; createdAt: string };
type Issue = { row: number; reason: string; value: string };
type Check = { dryRun: boolean; total: number; created: number; updated: number; accountsCreated: number; accountsUpdated: number; skipped: Issue[]; skippedCount: number; warnings: Issue[]; warningCount: number };

const BASE_LAYOUT = 'Base layout (not sendable)';
const FIELDS: { key: string; label: string; hints: string[] }[] = [
  { key: 'clinic_name', label: 'Clinic name (Account)', hints: ['clinic', 'practice', 'business', 'company', 'account', 'organization'] },
  { key: 'website', label: 'Website (Account)', hints: ['website', 'url', 'site', 'web'] },
  { key: 'city', label: 'City (Account)', hints: ['city', 'town'] },
  { key: 'province_state', label: 'Province / State (Account)', hints: ['province', 'state', 'region'] },
  { key: 'phone', label: 'Phone', hints: ['phone', 'tel', 'mobile'] },
  { key: 'contact_name', label: 'Contact full name', hints: ['contact_name', 'office_manager', 'manager', 'principal', 'dentist', 'owner', 'contact'] },
  { key: 'first_name', label: 'Contact first name', hints: ['first_name', 'firstname', 'first'] },
  { key: 'last_name', label: 'Contact last name', hints: ['last_name', 'lastname', 'surname', 'last'] },
  { key: 'email', label: 'Email', hints: ['email', 'e_mail', 'mail'] },
  { key: 'role', label: 'Role / title', hints: ['role', 'title', 'position'] },
];

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const when = (d: string | null | undefined) => (d ? new Date(d).toLocaleString() : '');
const card = 'rounded-lg border border-line bg-panel p-4 mb-5';
const inp = 'rounded-md border border-line bg-bg px-2 py-1 text-sm';
const btn = 'rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40';
const btn2 = 'rounded-md border border-line px-2 py-1 text-xs hover:bg-raised';
const th = 'px-2 py-1 text-left text-xs font-medium text-muted';
const td = 'px-2 py-1 text-xs align-top';

async function api(path: string, body?: unknown) {
  const r = await fetch('/api/send-os/' + path, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
  return j;
}

function guess(headers: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  const n = headers.map(norm);
  const used = new Set<number>();
  for (const f of FIELDS) {
    let i = n.findIndex((h, idx) => !used.has(idx) && (h === f.key || f.hints.includes(h)));
    if (i < 0) i = n.findIndex((h, idx) => !used.has(idx) && f.hints.some((k) => h.includes(k)));
    m[f.key] = i;
    if (i >= 0) used.add(i);
  }
  return m;
}

export default function SendPage() {
  // ----- leads -----
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [map, setMap] = useState<Record<string, number>>({});
  const [check, setCheck] = useState<Check | null>(null);
  const [leadMsg, setLeadMsg] = useState('');
  const [busy, setBusy] = useState('');
  // ----- templates -----
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [tplMsg, setTplMsg] = useState('');
  const [openTpl, setOpenTpl] = useState('');
  // ----- campaign -----
  const [tplId, setTplId] = useState('');
  const [campName, setCampName] = useState('');
  const [fq, setFq] = useState('');
  const [fCity, setFCity] = useState('');
  const [fProv, setFProv] = useState('');
  const [elig, setElig] = useState<Elig[]>([]);
  const [excl, setExcl] = useState<Excl[]>([]);
  const [previewed, setPreviewed] = useState(false);
  const [openRow, setOpenRow] = useState('');
  const [typed, setTyped] = useState('');
  const [sendMsg, setSendMsg] = useState('');
  const [sendRes, setSendRes] = useState<{ to: string; status: string; error?: string }[]>([]);
  // ----- history -----
  const [logs, setLogs] = useState<Log[]>([]);
  const [counts, setCounts] = useState<{ status: string; n: number }[]>([]);
  const [optOuts, setOptOuts] = useState(0);
  const [optEmail, setOptEmail] = useState('');

  const loadTpls = useCallback(async () => {
    try { const j = await api('templates'); setTpls(j.templates); } catch (e) { setTplMsg('Could not load templates: ' + (e as Error).message); }
  }, []);
  const loadHistory = useCallback(async () => {
    try { const j = await api('history'); setLogs(j.logs); setCounts(j.counts); setOptOuts(j.optOuts); } catch (e) { setSendMsg('Could not load history: ' + (e as Error).message); }
  }, []);
  useEffect(() => { loadTpls(); loadHistory(); }, [loadTpls, loadHistory]);

  const sheet = sheets[sheetIdx];
  const headers = sheet && sheet.rows[0] ? sheet.rows[0].map((h) => (h ?? '').trim()) : [];

  async function onLeadFile(f: File | undefined) {
    setCheck(null); setLeadMsg(''); setSheets([]); setFileName('');
    if (!f) return;
    try {
      const sh = (await readLeadFile(f)).filter((s) => s.rows.length > 0);
      if (!sh.length) { setLeadMsg('No data found in this file.'); return; }
      setFileName(f.name); setSheets(sh); setSheetIdx(0);
      setMap(guess((sh[0].rows[0] ?? []).map((h) => (h ?? '').trim())));
    } catch (e) { setLeadMsg('Could not read the file: ' + (e as Error).message); }
  }
  function pickSheet(i: number) {
    setSheetIdx(i); setCheck(null);
    setMap(guess((sheets[i].rows[0] ?? []).map((h) => (h ?? '').trim())));
  }
  function mappedRows(): Record<string, string>[] {
    if (!sheet) return [];
    return sheet.rows.slice(1).map((r) => {
      const o: Record<string, string> = {};
      for (const f of FIELDS) { const i = map[f.key]; o[f.key] = i >= 0 ? (r[i] ?? '').toString().trim() : ''; }
      return o;
    });
  }
  async function runLeads(dryRun: boolean) {
    setBusy(dryRun ? 'check' : 'import'); setLeadMsg('');
    try {
      const j = await api('leads', { rows: mappedRows(), fileName, dryRun });
      setCheck(j);
      setLeadMsg(dryRun ? 'Check finished. Nothing was saved yet.' : 'Import finished: ' + j.created + ' contacts created, ' + j.updated + ' updated.');
    } catch (e) { setLeadMsg('Failed: ' + (e as Error).message); }
    setBusy('');
  }

  async function onTemplateFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setTplMsg('Reading files...');
    const found: { file: string; html: string }[] = [];
    try {
      for (const f of Array.from(files)) {
        if (f.name.toLowerCase().endsWith('.zip')) {
          const z = await readZip(await f.arrayBuffer());
          const dec = new TextDecoder();
          Object.keys(z).forEach((p) => {
            const base = p.split('/').pop() ?? p;
            if (base.toLowerCase().endsWith('.html') && !base.startsWith('._') && !p.startsWith('__MACOSX')) found.push({ file: base, html: dec.decode(z[p]) });
          });
        } else if (f.name.toLowerCase().endsWith('.html')) found.push({ file: f.name, html: await f.text() });
      }
      let created = 0, updated = 0;
      const failed: string[] = [];
      for (const t of found) {
        const stem = t.file.replace(/\.html$/i, '');
        const isBase = /^base$/i.test(stem);
        const name = stem.replace(/^\d+[-_ ]*/, '').replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
        try {
          const r = await api('templates', {
            name: isBase ? 'Base layout' : name,
            subject: subjectFromHtml(t.html) || name,
            body: t.html,
            category: isBase ? BASE_LAYOUT : categoryFromFile(stem),
            variables: tokensIn(t.html),
            sourceFile: t.file,
          });
          if (r.action === 'created') created++; else updated++;
        } catch (e) { failed.push(t.file + ': ' + (e as Error).message); }
      }
      setTplMsg(found.length + ' template files read: ' + created + ' created, ' + updated + ' updated' + (failed.length ? ', FAILED: ' + failed.join('; ') : '') + '.');
      loadTpls();
    } catch (e) { setTplMsg('Could not read the files: ' + (e as Error).message); }
  }

  const sendable = tpls.filter((t) => t.category !== BASE_LAYOUT);
  const filter = { q: fq, city: fCity, province_state: fProv };

  async function runPreview() {
    setSendMsg(''); setSendRes([]); setTyped(''); setOpenRow('');
    try {
      const j = await api('preview', { templateId: tplId, filter });
      setElig(j.eligible); setExcl(j.excluded); setPreviewed(true);
    } catch (e) { setSendMsg('Preview failed: ' + (e as Error).message); setPreviewed(false); }
  }
  async function runSend() {
    setBusy('send'); setSendMsg('');
    try {
      const j = await api('send', { templateId: tplId, contactIds: elig.map((e) => e.contactId), campaignName: campName, confirm: 'SEND' });
      setSendRes(j.results);
      setSendMsg('Done: ' + j.sent + ' sent, ' + j.failed + ' failed, ' + j.bounced + ' bounced, ' + j.duplicates + ' skipped as duplicates.');
      setElig([]); setExcl([]); setPreviewed(false); setTyped('');
      loadHistory();
    } catch (e) { setSendMsg('Send failed: ' + (e as Error).message); }
    setBusy('');
  }
  async function mark(logId: string, status: string) {
    try { await api('status', { logId, status }); loadHistory(); } catch (e) { setSendMsg('Could not update: ' + (e as Error).message); }
  }
  async function addOptOut() {
    try { await api('status', { email: optEmail, status: 'opted_out' }); setOptEmail(''); setSendMsg('Opt-out saved.'); loadHistory(); } catch (e) { setSendMsg('Could not save opt-out: ' + (e as Error).message); }
  }

  const needMap = !map.email || map.email < 0 ? (map.clinic_name < 0 || map.clinic_name === undefined) : false;

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-1 text-xl font-semibold">Send Emails</h1>
      <p className="mb-5 text-sm text-muted">1. Upload leads - 2. Import templates - 3. Preview and send (manual, max {MAX_PER_RUN} per run, one email per recipient) - 4. Check history.</p>

      <section className={card}>
        <h2 className="mb-2 font-medium">1. Upload leads (CSV or XLSX)</h2>
        <input type="file" accept=".csv,.xlsx" data-testid="lead-file" onChange={(e) => onLeadFile(e.target.files?.[0])} />
        {sheets.length > 0 && (
          <div className="mt-3">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              <span>File: <b>{fileName}</b></span>
              <span>Sheet:</span>
              <select className={inp} value={sheetIdx} onChange={(e) => pickSheet(Number(e.target.value))}>
                {sheets.map((s, i) => <option key={i} value={i}>{s.name} ({Math.max(0, s.rows.length - 1)} rows)</option>)}
              </select>
            </div>
            <div className="mb-3 overflow-x-auto">
              <table className="text-xs"><thead><tr>{headers.map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
                <tbody>{sheet.rows.slice(1, 4).map((r, i) => <tr key={i}>{headers.map((_, j) => <td key={j} className={td}>{(r[j] ?? '').toString().slice(0, 40)}</td>)}</tr>)}</tbody></table>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {FIELDS.map((f) => (
                <label key={f.key} className="flex items-center justify-between gap-2 text-xs">
                  <span>{f.label}</span>
                  <select className={inp} value={map[f.key] ?? -1} onChange={(e) => { setMap({ ...map, [f.key]: Number(e.target.value) }); setCheck(null); }}>
                    <option value={-1}>- not mapped -</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || 'Column ' + (i + 1)}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button className={btn} disabled={!!busy || needMap} onClick={() => runLeads(true)}>{busy === 'check' ? 'Checking...' : 'Check file (saves nothing)'}</button>
              <button className={btn} disabled={!!busy || !check || !check.dryRun} onClick={() => runLeads(false)}>{busy === 'import' ? 'Importing...' : 'Import: create / update records'}</button>
            </div>
          </div>
        )}
        {leadMsg && <p className="mt-2 text-sm" data-testid="lead-msg">{leadMsg}</p>}
        {check && (
          <div className="mt-3 text-sm" data-testid="lead-result">
            <p>{check.dryRun ? 'Would' : 'Did'}: <b>{check.created}</b> new contacts, <b>{check.updated}</b> contacts updated, <b>{check.accountsCreated}</b> new accounts, <b>{check.accountsUpdated}</b> accounts updated, <b>{check.skippedCount}</b> rows skipped, <b>{check.warningCount}</b> warnings (of {check.total} rows).</p>
            {(check.skipped.length > 0 || check.warnings.length > 0) && (
              <div className="mt-2 max-h-56 overflow-auto">
                <table><thead><tr><th className={th}>Row</th><th className={th}>Type</th><th className={th}>Reason</th><th className={th}>Value</th></tr></thead>
                  <tbody>
                    {check.skipped.map((s, i) => <tr key={'s' + i}><td className={td}>{s.row}</td><td className={td}>Skipped</td><td className={td}>{s.reason}</td><td className={td}>{s.value}</td></tr>)}
                    {check.warnings.map((s, i) => <tr key={'w' + i}><td className={td}>{s.row}</td><td className={td}>Warning</td><td className={td}>{s.reason}</td><td className={td}>{s.value}</td></tr>)}
                  </tbody></table>
              </div>
            )}
          </div>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-2 font-medium">2. Email templates ({tpls.length} in the library)</h2>
        <p className="mb-2 text-xs text-muted">Upload a .zip or .html files. Name, subject, body, variables, category and source file are saved. Re-uploading the same file updates it. Variables you can use: {VARIABLES.map((v) => '{{' + v + '}}').join(' ')}</p>
        <input type="file" accept=".zip,.html" multiple data-testid="tpl-file" onChange={(e) => onTemplateFiles(e.target.files)} />
        {tplMsg && <p className="mt-2 text-sm" data-testid="tpl-msg">{tplMsg}</p>}
        <table className="mt-3 w-full"><thead><tr><th className={th}>Name</th><th className={th}>Category</th><th className={th}>Subject</th><th className={th}>Variables</th><th className={th}>Source file</th><th className={th}></th></tr></thead>
          <tbody>
            {tpls.map((t) => (
              <tr key={t.id} className="border-t border-line">
                <td className={td}>{t.name}</td><td className={td}>{t.category}</td><td className={td}>{t.subject}</td>
                <td className={td}>{(t.variables ?? []).join(', ')}</td><td className={td}>{t.sourceFile}</td>
                <td className={td}><button className={btn2} onClick={() => setOpenTpl(openTpl === t.id ? '' : t.id)}>{openTpl === t.id ? 'Hide' : 'View'}</button></td>
              </tr>
            ))}
          </tbody></table>
        {openTpl && <iframe className="mt-3 h-96 w-full rounded bg-white" sandbox="" srcDoc={tpls.find((t) => t.id === openTpl)?.body ?? ''} />}
      </section>

      <section className={card}>
        <h2 className="mb-2 font-medium">3. Campaign: preview and send</h2>
        <div className="flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col text-xs">Template
            <select className={inp} value={tplId} onChange={(e) => { setTplId(e.target.value); setPreviewed(false); }} data-testid="tpl-select">
              <option value="">- choose -</option>
              {sendable.map((t) => <option key={t.id} value={t.id}>{t.name} - {t.subject}</option>)}
            </select></label>
          <label className="flex flex-col text-xs">Campaign name (optional)<input className={inp} value={campName} onChange={(e) => setCampName(e.target.value)} /></label>
          <label className="flex flex-col text-xs">Search<input className={inp} value={fq} onChange={(e) => setFq(e.target.value)} data-testid="f-q" /></label>
          <label className="flex flex-col text-xs">City<input className={inp} value={fCity} onChange={(e) => setFCity(e.target.value)} /></label>
          <label className="flex flex-col text-xs">Province / State<input className={inp} value={fProv} onChange={(e) => setFProv(e.target.value)} /></label>
          <button className={btn} disabled={!tplId || !!busy} onClick={runPreview} data-testid="preview-btn">Preview</button>
        </div>
        {sendMsg && <p className="mt-2 text-sm" data-testid="send-msg">{sendMsg}</p>}
        {previewed && (
          <div className="mt-3" data-testid="preview">
            <p className="mb-2 text-sm"><b>{elig.length}</b> will be sent (max {MAX_PER_RUN} per run) - <b>{excl.length}</b> excluded.</p>
            <div className="max-h-80 overflow-auto">
              <table className="w-full"><thead><tr><th className={th}>Clinic</th><th className={th}>Contact</th><th className={th}>To</th><th className={th}>Personalized subject</th><th className={th}></th></tr></thead>
                <tbody>
                  {elig.map((e) => (
                    <>
                      <tr key={e.contactId} className="border-t border-line"><td className={td}>{e.clinic}</td><td className={td}>{e.name}</td><td className={td}>{e.to}</td><td className={td}>{e.subject}</td>
                        <td className={td}><button className={btn2} onClick={() => setOpenRow(openRow === e.contactId ? '' : e.contactId)}>Body</button></td></tr>
                      {openRow === e.contactId && <tr key={e.contactId + 'b'}><td colSpan={5}><iframe className="h-96 w-full rounded bg-white" sandbox="" srcDoc={e.html} /></td></tr>}
                    </>
                  ))}
                </tbody></table>
            </div>
            {excl.length > 0 && (
              <details className="mt-3" open>
                <summary className="cursor-pointer text-sm">Excluded rows ({excl.length})</summary>
                <div className="max-h-56 overflow-auto">
                  <table className="w-full"><thead><tr><th className={th}>Clinic</th><th className={th}>Contact</th><th className={th}>Email</th><th className={th}>Reason</th></tr></thead>
                    <tbody>{excl.map((e, i) => <tr key={i} className="border-t border-line"><td className={td}>{e.clinic}</td><td className={td}>{e.name}</td><td className={td}>{e.email}</td><td className={td}>{e.reason}</td></tr>)}</tbody></table>
                </div>
              </details>
            )}
            {elig.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span>To confirm sending {elig.length} real email(s), type <b>SEND</b>:</span>
                <input className={inp} value={typed} onChange={(e) => setTyped(e.target.value)} data-testid="confirm-input" />
                <button className={btn} disabled={typed !== 'SEND' || !!busy} onClick={runSend} data-testid="send-btn">{busy === 'send' ? 'Sending...' : 'Send ' + elig.length + ' email(s) now'}</button>
              </div>
            )}
          </div>
        )}
        {sendRes.length > 0 && (
          <table className="mt-3"><tbody>{sendRes.map((r, i) => <tr key={i}><td className={td}>{r.to}</td><td className={td}>{r.status}</td><td className={td}>{r.error}</td></tr>)}</tbody></table>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-2 font-medium">4. History</h2>
        <p className="mb-2 text-xs text-muted">{counts.map((c) => c.status + ': ' + c.n).join(' - ') || 'No messages yet'} - opt-outs: {optOuts}</p>
        <div className="mb-3 flex items-center gap-2 text-sm">
          <input className={inp} placeholder="Add an opt-out email" value={optEmail} onChange={(e) => setOptEmail(e.target.value)} />
          <button className={btn2} onClick={addOptOut}>Add opt-out</button>
          <button className={btn2} onClick={loadHistory}>Refresh</button>
        </div>
        <div className="max-h-96 overflow-auto">
          <table className="w-full" data-testid="history"><thead><tr><th className={th}>Campaign</th><th className={th}>To</th><th className={th}>Subject</th><th className={th}>Status</th><th className={th}>Sent</th><th className={th}>Failed</th><th className={th}>Bounced</th><th className={th}>Replied</th><th className={th}>Opted out</th><th className={th}>Error</th><th className={th}></th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-line">
                  <td className={td}>{l.campaignName}</td><td className={td}>{l.toEmail}</td><td className={td}>{l.subject}</td><td className={td}><b>{l.status}</b></td>
                  <td className={td}>{when(l.sentAt)}</td><td className={td}>{when(l.failedAt)}</td><td className={td}>{when(l.bouncedAt)}</td><td className={td}>{when(l.repliedAt)}</td><td className={td}>{when(l.optedOutAt)}</td><td className={td}>{l.error}</td>
                  <td className={td}><span className="flex gap-1"><button className={btn2} onClick={() => mark(l.id, 'replied')}>Replied</button><button className={btn2} onClick={() => mark(l.id, 'bounced')}>Bounced</button><button className={btn2} onClick={() => mark(l.id, 'opted_out')}>Opt out</button></span></td>
                </tr>
              ))}
            </tbody></table>
        </div>
      </section>
    </div>
  );
}
