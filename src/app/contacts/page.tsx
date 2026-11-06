'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Phone, Plus, Upload } from 'lucide-react';
import { useStore, useUi } from '@/lib/store';
import { cn, download, fmtDate, money, parseCSV, toCSV, uid } from '@/lib/utils';
import { Badge, Button, Card, Drawer, Empty, inputCls, PageHeader } from '@/components/ui';
import { ActivityFormModal, ContactFormModal, LEAD_STATUSES, REPS, SOURCES } from '@/components/forms';
import type { Activity, Contact, LeadSource, LeadStatus } from '@/types/sales-os';

const statusTone = (s: LeadStatus) =>
  s === 'Qualified' ? 'green' : s === 'Unqualified' ? 'red' : s === 'New' ? 'blue' : 'amber';

export default function ContactsPage() {
  const contacts = useStore((s) => s.contacts);
  const accounts = useStore((s) => s.accounts);
  const deals = useStore((s) => s.deals);
  const activities = useStore((s) => s.activities);
  const currency = useStore((s) => s.settings.currency);
  const upsert = useStore((s) => s.upsert);
  const upsertMany = useStore((s) => s.upsertMany);
  const focus = useUi((s) => s.focus);
  const setFocus = useUi((s) => s.setFocus);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [tag, setTag] = useState('');
  const [owner, setOwner] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [creating, setCreating] = useState(false);
  const [logging, setLogging] = useState<Partial<Activity> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focus?.kind === 'contact') {
      setOpen(focus.id);
      setFocus(null);
    }
  }, [focus, setFocus]);

  const accName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—';
  const allTags = useMemo(() => Array.from(new Set(contacts.flatMap((c) => c.tags))).sort(), [contacts]);
  const rows = contacts.filter((c) => {
    const needle = q.trim().toLowerCase();
    return (
      (!needle || `${c.firstName} ${c.lastName} ${c.email} ${c.role} ${accName(c.accountId)}`.toLowerCase().includes(needle)) &&
      (!status || c.leadStatus === status) &&
      (!source || c.source === source) &&
      (!tag || c.tags.includes(tag)) &&
      (!owner || c.owner === owner)
    );
  });

  const exportCsv = () =>
    download(
      'contacts.csv',
      toCSV(
        rows.map((c) => ({
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          phone: c.phone,
          role: c.role,
          account: accName(c.accountId),
          leadStatus: c.leadStatus,
          leadScore: c.leadScore,
          source: c.source,
          tags: c.tags.join(';'),
          owner: c.owner,
        })),
      ),
      'text/csv',
    );

  const importCsv = async (file: File) => {
    const table = parseCSV(await file.text());
    if (table.length < 2) return;
    const head = table[0].map((h) => h.trim());
    const col = (row: string[], name: string) => row[head.indexOf(name)]?.trim() ?? '';
    const now = new Date().toISOString();
    const imported: Contact[] = table
      .slice(1)
      .filter((r) => col(r, 'firstName') || col(r, 'lastName'))
      .map((r) => {
        const st = col(r, 'leadStatus') as LeadStatus;
        const so = col(r, 'source') as LeadSource;
        return {
          id: uid('con'),
          accountId: accounts.find((a) => a.name.toLowerCase() === col(r, 'account').toLowerCase())?.id ?? '',
          firstName: col(r, 'firstName'),
          lastName: col(r, 'lastName'),
          email: col(r, 'email'),
          phone: col(r, 'phone'),
          role: col(r, 'role'),
          leadStatus: LEAD_STATUSES.includes(st) ? st : 'New',
          leadScore: Number(col(r, 'leadScore')) || 50,
          source: SOURCES.includes(so) ? so : 'Inbound',
          tags: col(r, 'tags').split(';').map((t) => t.trim()).filter(Boolean),
          owner: col(r, 'owner') || REPS[0],
          lastContactedAt: null,
          createdAt: now,
        };
      });
    upsertMany('contacts', imported);
  };

  const bulk = (st: LeadStatus) => {
    contacts.filter((c) => selected.includes(c.id)).forEach((c) => upsert('contacts', { ...c, leadStatus: st }));
    setSelected([]);
  };

  const current = contacts.find((c) => c.id === open);
  const timeline = current
    ? activities.filter((a) => a.contactId === current.id).sort((a, b) => b.dueDate.localeCompare(a.dueDate))
    : [];

  return (
    <>
      <PageHeader
        title="Contacts & Leads"
        subtitle={`${rows.length} of ${contacts.length} records`}
        actions={
          <>
            <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importCsv(f); e.target.value = ''; }} />
            <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload size={14} /> Import CSV</Button>
            <Button variant="outline" onClick={exportCsv}><Download size={14} /> Export CSV</Button>
            <Button onClick={() => setCreating(true)}><Plus size={14} /> New contact</Button>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <input className={cn(inputCls, 'w-56')} placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={cn(inputCls, 'w-40')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className={cn(inputCls, 'w-36')} value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">All sources</option>
          {SOURCES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className={cn(inputCls, 'w-40')} value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">All tags</option>
          {allTags.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className={cn(inputCls, 'w-40')} value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">All owners</option>
          {REPS.map((t) => <option key={t}>{t}</option>)}
        </select>
        {selected.length > 0 && (
          <select className={cn(inputCls, 'w-48')} value="" onChange={(e) => bulk(e.target.value as LeadStatus)}>
            <option value="">Set {selected.length} selected to...</option>
            {LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        )}
      </div>

      <Card className="overflow-x-auto">
        {rows.length === 0 ? (
          <Empty text="No contacts match your filters" />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={selected.length === rows.length}
                    onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])}
                  />
                </th>
                {['Name', 'Account', 'Role', 'Status', 'Score', 'Source', 'Owner'].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="cursor-pointer border-t border-line hover:bg-raised" onClick={() => setOpen(c.id)}>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${c.firstName}`}
                      checked={selected.includes(c.id)}
                      onChange={(e) => setSelected(e.target.checked ? [...selected, c.id] : selected.filter((x) => x !== c.id))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{c.firstName} {c.lastName}</p>
                    <p className="text-xs text-muted">{c.email}</p>
                  </td>
                  <td className="px-3 py-2">{accName(c.accountId)}</td>
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
      </Card>

      {current && (
        <Drawer title={`${current.firstName} ${current.lastName}`} onClose={() => setOpen(null)}>
          <p className="text-sm text-muted">{current.role} · {accName(current.accountId)}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <p>Email: {current.email || '—'}</p>
            <p>Phone: {current.phone || '—'}</p>
            <p>Status: <Badge tone={statusTone(current.leadStatus)}>{current.leadStatus}</Badge></p>
            <p>Score: {current.leadScore}</p>
            <p>Last contacted: {fmtDate(current.lastContactedAt)}</p>
            <p>Owner: {current.owner}</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">{current.tags.map((t) => <Badge key={t} tone="violet">{t}</Badge>)}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditing(current)}>Edit</Button>
            <Button variant="outline" onClick={() => setLogging({ type: 'call', contactId: current.id, status: 'completed', outcome: 'Connected' })}><Phone size={14} /> Log call</Button>
            <Button variant="outline" onClick={() => setLogging({ type: 'email', contactId: current.id, status: 'completed' })}>Log email</Button>
            <Button variant="outline" onClick={() => setLogging({ type: 'note', contactId: current.id, status: 'completed' })}>Add note</Button>
          </div>
          <h3 className="mb-2 mt-5 text-sm font-semibold">Linked deals</h3>
          <ul className="space-y-1 text-sm">
            {deals.filter((d) => d.primaryContactId === current.id).map((d) => (
              <li key={d.id} className="flex justify-between"><span>{d.title}</span><span>{money(d.value, currency)}</span></li>
            ))}
            {deals.every((d) => d.primaryContactId !== current.id) && <li className="text-muted">No linked deals</li>}
          </ul>
          <h3 className="mb-2 mt-5 text-sm font-semibold">Activity timeline</h3>
          <ul className="space-y-2 border-l border-line pl-4 text-sm">
            {timeline.map((a) => (
              <li key={a.id}>
                <p className="font-medium">{a.subject}</p>
                <p className="text-xs text-muted">{a.type} · {fmtDate(a.dueDate)} · {a.status}{a.outcome ? ` · ${a.outcome}` : ''}</p>
              </li>
            ))}
            {timeline.length === 0 && <li className="text-muted">No activity yet</li>}
          </ul>
        </Drawer>
      )}
      {editing && <ContactFormModal contact={editing} onClose={() => { setEditing(null); setOpen(null); }} />}
      {creating && <ContactFormModal onClose={() => setCreating(false)} />}
      {logging && <ActivityFormModal preset={logging} onClose={() => setLogging(null)} />}
    </>
  );
}
