'use client';

import { useEffect, useState } from 'react';
import { Download, Plus, Upload } from 'lucide-react';
import { useStore, useUi } from '@/lib/store';
import { cn, download, money, toCSV } from '@/lib/utils';
import { Badge, Button, Card, Drawer, Empty, inputCls, PageHeader } from '@/components/ui';
import { AccountFormModal } from '@/components/forms';
import { ImportWizard, Pager, useDebounced, useList } from '@/components/data';
import { dbCall } from '@/lib/api';
import type { Account, Contact } from '@/types/sales-os';

type Row = Account & { contactCount: number };

export default function AccountsPage() {
  const deals = useStore((s) => s.deals);
  const stages = useStore((s) => s.settings.stages);
  const currency = useStore((s) => s.settings.currency);
  const version = useStore((s) => s.dbVersion);
  const focus = useUi((s) => s.focus);
  const setFocus = useUi((s) => s.setFocus);
  const [q, setQ] = useState('');
  const [tier, setTier] = useState('');
  const [sort, setSort] = useState('created_at:desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [open, setOpen] = useState<Row | null>(null);
  const [people, setPeople] = useState<Contact[]>([]);
  const [editing, setEditing] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

  const dq = useDebounced(q);
  const filters: Record<string, string> = {};
  if (dq) filters.q = dq;
  if (tier) filters.tier = tier;
  const [sortCol, sortDir] = sort.split(':');
  const { rows, total, loading, error, reload } = useList<Row>('accounts', { ...filters, page: String(page), pageSize: String(pageSize), sort: sortCol, dir: sortDir }, [version]);

  useEffect(() => {
    if (focus?.kind === 'account') {
      dbCall<{ rows: Row[] }>('GET', '/api/db/accounts?id=' + encodeURIComponent(focus.id)).then((r) => { if (r.rows[0]) setOpen(r.rows[0]); }).catch(() => undefined);
      setFocus(null);
    }
  }, [focus, setFocus]);

  useEffect(() => {
    if (!open) { setPeople([]); return; }
    dbCall<{ rows: Contact[] }>('GET', '/api/db/contacts?pageSize=100&accountId=' + encodeURIComponent(open.id)).then((r) => setPeople(r.rows)).catch(() => undefined);
  }, [open]);

  const exportCsv = async () => {
    const out: Row[] = [];
    for (let p = 1; p <= 20; p++) {
      const r = await dbCall<{ rows: Row[] }>('GET', '/api/db/accounts?' + new URLSearchParams({ ...filters, all: '1', page: String(p) }).toString());
      out.push(...r.rows);
      if (r.rows.length < 1000) break;
    }
    download('accounts.csv', toCSV(out.map((a) => ({ name: a.name, domain: a.domain, industry: a.industry, size: a.size, annualRevenue: a.annualRevenue, tier: a.tier, contacts: a.contactCount }))), 'text/csv');
  };

  const value = (id: string) => deals.filter((d) => d.accountId === id && d.stage !== 'closed_lost').reduce((a, d) => a + d.value, 0);
  const reset = (fn: (v: string) => void) => (v: string) => { fn(v); setPage(1); };

  return (
    <>
      <PageHeader
        title="Companies & Accounts"
        subtitle={total.toLocaleString() + ' accounts' + (loading ? ' (loading...)' : '')}
        actions={
          <>
            <input className={cn(inputCls, 'w-48')} placeholder="Search..." value={q} onChange={(e) => reset(setQ)(e.target.value)} />
            <select className={cn(inputCls, 'w-36')} value={tier} onChange={(e) => reset(setTier)(e.target.value)}>
              <option value="">All tiers</option>
              <option>Enterprise</option>
              <option>Mid-Market</option>
              <option>SMB</option>
            </select>
            <select className={cn(inputCls, 'w-40')} value={sort} onChange={(e) => reset(setSort)(e.target.value)}>
              <option value="created_at:desc">Newest first</option>
              <option value="name:asc">Name A-Z</option>
              <option value="annual_revenue:desc">Revenue high-low</option>
            </select>
            <Button variant="outline" onClick={() => setImporting(true)}><Upload size={14} /> Import CSV</Button>
            <Button variant="outline" onClick={() => void exportCsv()}><Download size={14} /> Export CSV</Button>
            <Button onClick={() => setCreating(true)}><Plus size={14} /> New account</Button>
          </>
        }
      />
      {error && <p className="mb-2 text-sm text-red-400">Could not load: {error}</p>}
      <Card className="overflow-x-auto">
        {rows.length === 0 ? (
          <Empty text={loading ? 'Loading...' : 'No accounts found'} />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>{['Company', 'Industry', 'Tier', 'Contacts', 'Deals', 'Account value'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} onClick={() => setOpen(a)} className="cursor-pointer border-t border-line hover:bg-raised">
                  <td className="px-3 py-2"><p className="font-medium">{a.name}</p><p className="text-xs text-muted">{a.domain}</p></td>
                  <td className="px-3 py-2">{a.industry}</td>
                  <td className="px-3 py-2"><Badge tone={a.tier === 'Enterprise' ? 'violet' : a.tier === 'SMB' ? 'slate' : 'blue'}>{a.tier}</Badge></td>
                  <td className="px-3 py-2">{a.contactCount}</td>
                  <td className="px-3 py-2">{deals.filter((d) => d.accountId === a.id).length}</td>
                  <td className="px-3 py-2">{money(value(a.id), currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager page={page} pageSize={pageSize} total={total} onPage={setPage} onSize={(n) => { setPageSize(n); setPage(1); }} />
      </Card>

      {open && (
        <Drawer title={open.name} onClose={() => setOpen(null)}>
          <p className="text-sm text-muted">{open.domain} · {open.industry}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <p>Tier: {open.tier}</p>
            <p>Employees: {Number(open.size).toLocaleString()}</p>
            <p>Annual revenue: {money(Number(open.annualRevenue), currency, 'en-US', true)}</p>
            <p>Account value: {money(value(open.id), currency)}</p>
          </div>
          <div className="mt-4"><Button variant="outline" onClick={() => setEditing(open)}>Edit account</Button></div>
          <h3 className="mb-2 mt-5 text-sm font-semibold">Contacts ({open.contactCount})</h3>
          <ul className="space-y-1 text-sm">
            {people.map((c) => <li key={c.id} className="flex justify-between"><span>{c.firstName} {c.lastName} · {c.role}</span><Badge>{c.leadStatus}</Badge></li>)}
          </ul>
          <h3 className="mb-2 mt-5 text-sm font-semibold">Deals</h3>
          <ul className="space-y-1 text-sm">
            {deals.filter((d) => d.accountId === open.id).map((d) => (
              <li key={d.id} className="flex justify-between"><span>{d.title} <span className="text-muted">({stages.find((s) => s.id === d.stage)?.label})</span></span><span>{money(d.value, currency)}</span></li>
            ))}
          </ul>
        </Drawer>
      )}
      {editing && <AccountFormModal account={editing} onClose={() => { setEditing(null); setOpen(null); }} />}
      {creating && <AccountFormModal onClose={() => setCreating(false)} />}
      {importing && <ImportWizard entity="accounts" onClose={() => setImporting(false)} onDone={reload} />}
    </>
  );
}
