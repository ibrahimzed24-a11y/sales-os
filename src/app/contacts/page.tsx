'use client';

import { useEffect, useState } from 'react';
import { Download, Phone, Plus, Upload } from 'lucide-react';
import { refreshDirectory, useStore, useUi } from '@/lib/store';
import { cn, download, fmtDate, money, toCSV } from '@/lib/utils';
import { Badge, Button, Card, Drawer, Empty, inputCls, PageHeader } from '@/components/ui';
import { ActivityFormModal, ContactFormModal, LEAD_STATUSES, REPS, SOURCES } from '@/components/forms';
import { ImportWizard, Pager, useDebounced, useList } from '@/components/data';
import { dbCall } from '@/lib/api';
import type { Activity, Contact, LeadStatus } from '@/types/sales-os';

type Row = Contact & { accountName: string };

const statusTone = (s: LeadStatus) => (s === 'Qualified' ? 'green' : s === 'Unqualified' ? 'red' : s === 'New' ? 'blue' : 'amber');

export default function ContactsPage() {
  const deals = useStore((s) => s.deals);
  const activities = useStore((s) => s.activities);
  const currency = useStore((s) => s.settings.currency);
  const version = useStore((s) => s.dbVersion);
  const focus = useUi((s) => s.focus);
  const setFocus = useUi((s) => s.setFocus);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [tag, setTag] = useState('');
  const [owner, setOwner] = useState('');
  const [sort, setSort] = useState('created_at:desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState<string[]>([]);
  const [allMatching, setAllMatching] = useState(false);
  const [open, setOpen] = useState<Row | null>(null);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [creating, setCreating] = useState(false);
  const [logging, setLogging] = useState<Partial<Activity> | null>(null);
  const [importing, setImporting] = useState(false);

  const dq = useDebounced(q);
  const filters: Record<string, string> = {};
  if (dq) filters.q = dq;
  if (status) filters.leadStatus = status;
  if (source) filters.source = source;
  if (owner) filters.owner = owner;
  if (tag.trim()) filters.tag = tag.trim();
  const [sortCol, sortDir] = sort.split(':');
  const { rows, total, loading, error, reload } = useList<Row>('contacts', { ...filters, page: String(page), pageSize: String(pageSize), sort: sortCol, dir: sortDir }, [version]);

  useEffect(() => {
    if (focus?.kind === 'contact') {
      dbCall<{ rows: Row[] }>('GET', '/api/db/contacts?id=' + encodeURIComponent(focus.id)).then((r) => { if (r.rows[0]) setOpen(r.rows[0]); }).catch(() => undefined);
      setFocus(null);
    }
  }, [focus, setFocus]);

  const f = (fn: (v: string) => void) => (v: string) => { fn(v); setPage(1); setSelected([]); setAllMatching(false); };

  const exportCsv = async () => {
    const out: Row[] = [];
    for (let p = 1; p <= 20; p++) {
      const r = await dbCall<{ rows: Row[] }>('GET', '/api/db/contacts?' + new URLSearchParams({ ...filters, all: '1', page: String(p) }).toString());
      out.push(...r.rows);
      if (r.rows.length < 1000) break;
    }
    download('contacts.csv', toCSV(out.map((c) => ({ firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone, role: c.role, account: c.accountName, leadStatus: c.leadStatus, leadScore: c.leadScore, source: c.source, tags: c.tags.join(';'), owner: c.owner }))), 'text/csv');
  };

  const bulk = async (st: string) => {
    if (!st) return;
    await dbCall('PATCH', '/api/db/contacts', allMatching ? { all: true, filters, patch: { leadStatus: st } } : { ids: selected, patch: { leadStatus: st } });
    setSelected([]);
    setAllMatching(false);
    reload();
    void refreshDirectory();
  };

  const timeline = open ? activities.filter((a) => a.contactId === open.id).sort((a, b) => b.dueDate.localeCompare(a.dueDate)) : [];

  return (
    <>
      <PageHeader
        title="Contacts & Leads"
        subtitle={total.toLocaleString() + ' matching records' + (loading ? ' (loading...)' : '')}
        actions={
          <>
            <Button variant="outline" onClick={() => setImporting(true)}><Upload size={14} /> Import CSV</Button>
            <Button variant="outline" onClick={() => void exportCsv()}><Download size={14} /> Export CSV</Button>
            <Button onClick={() => setCreating(true)}><Plus size={14} /> New contact</Button>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <input className={cn(inputCls, 'w-56')} placeholder="Search name, email, phone..." value={q} onChange={(e) => f(setQ)(e.target.value)} />
        <select className={cn(inputCls, 'w-40')} value={status} onChange={(e) => f(setStatus)(e.target.value)}>
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className={cn(inputCls, 'w-36')} value={source} onChange={(e) => f(setSource)(e.target.value)}>
          <option value="">All sources</option>
          {SOURCES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <input className={cn(inputCls, 'w-32')} placeholder="Tag" value={tag} onChange={(e) => f(setTag)(e.target.value)} />
        <select className={cn(inputCls, 'w-40')} value={owner} onChange={(e) => f(setOwner)(e.target.value)}>
          <option value="">All owners</option>
          {REPS.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className={cn(inputCls, 'w-40')} value={sort} onChange={(e) => f(setSort)(e.target.value)}>
          <option value="created_at:desc">Newest first</option>
          <option value="created_at:asc">Oldest first</option>
          <option value="first_name:asc">Name A-Z</option>
          <option value="lead_score:desc">Score high-low</option>
        </select>
        {selected.length > 0 && (
          <select className={cn(inputCls, 'w-56')} value="" onChange={(e) => void bulk(e.target.value)}>
            <option value="">Set {allMatching ? total.toLocaleString() : selected.length} selected to...</option>
            {LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        )}
        {selected.length === rows.length && rows.length > 0 && total > rows.length && !allMatching && (
          <Button variant="ghost" onClick={() => setAllMatching(true)}>Select all {total.toLocaleString()} matching</Button>
        )}
      </div>
      {error && <p className="mb-2 text-sm text-red-400">Could not load: {error}</p>}
      <Card className="overflow-x-auto">
        {rows.length === 0 ? (
          <Empty text={loading ? 'Loading...' : 'No contacts match your filters'} />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="w-8 px-3 py-2"><input type="checkbox" aria-label="Select all" checked={selected.length === rows.length} onChange={(e) => { setSelected(e.target.checked ? rows.map((r) => r.id) : []); setAllMatching(false); }} /></th>
                {['Name', 'Account', 'Role', 'Status', 'Score', 'Source', 'Owner'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="cursor-pointer border-t border-line hover:bg-raised" onClick={() => setOpen(c)}>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label={'Select ' + c.firstName} checked={selected.includes(c.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, c.id] : selected.filter((x) => x !== c.id))} />
                  </td>
                  <td className="px-3 py-2"><p className="font-medium">{c.firstName} {c.lastName}</p><p className="text-xs text-muted">{c.email}</p></td>
                  <td className="px-3 py-2">{c.accountName || '-'}</td>
                  <td className="px-3 py-2">{c.role}</td>
                  <td className="px-3 py-2"><Badge tone={statusTone(c.leadStatus)}>{c.leadStatus}</Badge></td>
                  <td className="px-3 py-2">{c.leadScore}</td>
                  <td className="px-3 py-2">{c.source}</td>
                  <td className="px-3 py-2">{c.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager page={page} pageSize={pageSize} total={total} onPage={(p) => { setPage(p); setSelected([]); setAllMatching(false); }} onSize={(n) => { setPageSize(n); setPage(1); setSelected([]); }} />
      </Card>

      {open && (
        <Drawer title={open.firstName + ' ' + open.lastName} onClose={() => setOpen(null)}>
          <p className="text-sm text-muted">{open.role} · {open.accountName || '-'}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <p>Email: {open.email || '-'}</p>
            <p>Phone: {open.phone || '-'}</p>
            <p>Status: <Badge tone={statusTone(open.leadStatus)}>{open.leadStatus}</Badge></p>
            <p>Score: {open.leadScore}</p>
            <p>Last contacted: {fmtDate(open.lastContactedAt)}</p>
            <p>Owner: {open.owner}</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">{open.tags.map((t) => <Badge key={t} tone="violet">{t}</Badge>)}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditing(open)}>Edit</Button>
            <Button variant="outline" onClick={() => setLogging({ type: 'call', contactId: open.id, status: 'completed', outcome: 'Connected' })}><Phone size={14} /> Log call</Button>
            <Button variant="outline" onClick={() => setLogging({ type: 'email', contactId: open.id, status: 'completed' })}>Log email</Button>
            <Button variant="outline" onClick={() => setLogging({ type: 'note', contactId: open.id, status: 'completed' })}>Add note</Button>
          </div>
          <h3 className="mb-2 mt-5 text-sm font-semibold">Linked deals</h3>
          <ul className="space-y-1 text-sm">
            {deals.filter((d) => d.primaryContactId === open.id).map((d) => <li key={d.id} className="flex justify-between"><span>{d.title}</span><span>{money(d.value, currency)}</span></li>)}
            {deals.every((d) => d.primaryContactId !== open.id) && <li className="text-muted">No linked deals</li>}
          </ul>
          <h3 className="mb-2 mt-5 text-sm font-semibold">Activity timeline</h3>
          <ul className="space-y-2 border-l border-line pl-4 text-sm">
            {timeline.map((a) => <li key={a.id}><p className="font-medium">{a.subject}</p><p className="text-xs text-muted">{a.type} · {fmtDate(a.dueDate)} · {a.status}{a.outcome ? ' · ' + a.outcome : ''}</p></li>)}
            {timeline.length === 0 && <li className="text-muted">No activity yet</li>}
          </ul>
        </Drawer>
      )}
      {editing && <ContactFormModal contact={editing} onClose={() => { setEditing(null); setOpen(null); }} />}
      {creating && <ContactFormModal onClose={() => setCreating(false)} />}
      {logging && <ActivityFormModal preset={logging} onClose={() => setLogging(null)} />}
      {importing && <ImportWizard entity="contacts" onClose={() => setImporting(false)} onDone={reload} />}
    </>
  );
}
