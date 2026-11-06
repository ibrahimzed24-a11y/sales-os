'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Plus, Upload } from 'lucide-react';
import { useStore, useUi } from '@/lib/store';
import { cn, download, money, parseCSV, toCSV, uid } from '@/lib/utils';
import { Badge, Button, Card, Drawer, Empty, inputCls, PageHeader } from '@/components/ui';
import { AccountFormModal } from '@/components/forms';
import type { Account } from '@/types/sales-os';

export default function AccountsPage() {
  const accounts = useStore((s) => s.accounts);
  const upsertMany = useStore((s) => s.upsertMany);
  const fileRef = useRef<HTMLInputElement>(null);
  const contacts = useStore((s) => s.contacts);
  const deals = useStore((s) => s.deals);
  const stages = useStore((s) => s.settings.stages);
  const currency = useStore((s) => s.settings.currency);
  const focus = useUi((s) => s.focus);
  const setFocus = useUi((s) => s.setFocus);
  const [q, setQ] = useState('');
  const [tier, setTier] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (focus?.kind === 'account') {
      setOpen(focus.id);
      setFocus(null);
    }
  }, [focus, setFocus]);

  const exportCsv = () =>
    download(
      'accounts.csv',
      toCSV(accounts.map((a) => ({ name: a.name, domain: a.domain, industry: a.industry, size: a.size, annualRevenue: a.annualRevenue, tier: a.tier }))),
      'text/csv',
    );

  const importCsv = async (file: File) => {
    const table = parseCSV(await file.text());
    if (table.length < 2) {
      window.alert('Import failed: the file needs a header row and at least one data row.');
      return;
    }
    const head = table[0].map((h) => h.trim());
    if (!head.includes('name')) {
      window.alert('Import failed: the CSV needs a name column. Columns found: ' + head.join(', '));
      return;
    }
    const col = (row: string[], name: string) => row[head.indexOf(name)]?.trim() ?? '';
    const now = new Date().toISOString();
    const seen = new Set(accounts.map((a) => a.name.toLowerCase()));
    const imported: Account[] = [];
    let skippedDup = 0;
    let skippedNoName = 0;
    for (const r of table.slice(1)) {
      if (!r.some((x) => x.trim())) continue;
      const name = col(r, 'name');
      if (!name) {
        skippedNoName++;
        continue;
      }
      if (seen.has(name.toLowerCase())) {
        skippedDup++;
        continue;
      }
      seen.add(name.toLowerCase());
      const tier = col(r, 'tier') as Account['tier'];
      imported.push({
        id: uid('acc'),
        name,
        domain: col(r, 'domain'),
        industry: col(r, 'industry'),
        size: Number(col(r, 'size')) || 0,
        annualRevenue: Number(col(r, 'annualRevenue')) || 0,
        tier: ['Enterprise', 'Mid-Market', 'SMB'].includes(tier) ? tier : 'SMB',
        createdAt: now,
      });
    }
    if (imported.length) upsertMany('accounts', imported);
    window.alert(`Imported ${imported.length} account(s). Skipped ${skippedDup} duplicate name(s) and ${skippedNoName} row(s) without a name.`);
  };

  const total = (id: string) =>
    deals.filter((d) => d.accountId === id && d.stage !== 'closed_lost').reduce((a, d) => a + d.value, 0);
  const rows = accounts.filter(
    (a) => (!q || `${a.name} ${a.domain} ${a.industry}`.toLowerCase().includes(q.toLowerCase())) && (!tier || a.tier === tier),
  );
  const current = accounts.find((a) => a.id === open);

  return (
    <>
      <PageHeader
        title="Companies & Accounts"
        subtitle={`${rows.length} accounts`}
        actions={
          <>
            <input className={cn(inputCls, 'w-48')} placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
            <select className={cn(inputCls, 'w-36')} value={tier} onChange={(e) => setTier(e.target.value)}>
              <option value="">All tiers</option>
              <option>Enterprise</option>
              <option>Mid-Market</option>
              <option>SMB</option>
            </select>
            <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importCsv(f); e.target.value = ''; }} />
            <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload size={14} /> Import CSV</Button>
            <Button variant="outline" onClick={exportCsv}><Download size={14} /> Export CSV</Button>
            <Button onClick={() => setCreating(true)}><Plus size={14} /> New account</Button>
          </>
        }
      />
      <Card className="overflow-x-auto">
        {rows.length === 0 ? (
          <Empty text="No accounts found" />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                {['Company', 'Industry', 'Tier', 'Contacts', 'Deals', 'Account value'].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} onClick={() => setOpen(a.id)} className="cursor-pointer border-t border-line hover:bg-raised">
                  <td className="px-3 py-2"><p className="font-medium">{a.name}</p><p className="text-xs text-muted">{a.domain}</p></td>
                  <td className="px-3 py-2">{a.industry}</td>
                  <td className="px-3 py-2"><Badge tone={a.tier === 'Enterprise' ? 'violet' : a.tier === 'SMB' ? 'slate' : 'blue'}>{a.tier}</Badge></td>
                  <td className="px-3 py-2">{contacts.filter((c) => c.accountId === a.id).length}</td>
                  <td className="px-3 py-2">{deals.filter((d) => d.accountId === a.id).length}</td>
                  <td className="px-3 py-2">{money(total(a.id), currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {current && (
        <Drawer title={current.name} onClose={() => setOpen(null)}>
          <p className="text-sm text-muted">{current.domain} · {current.industry}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <p>Tier: {current.tier}</p>
            <p>Employees: {current.size.toLocaleString()}</p>
            <p>Annual revenue: {money(current.annualRevenue, currency, 'en-US', true)}</p>
            <p>Account value: {money(total(current.id), currency)}</p>
          </div>
          <div className="mt-4"><Button variant="outline" onClick={() => setEditing(current)}>Edit account</Button></div>
          <h3 className="mb-2 mt-5 text-sm font-semibold">Contacts</h3>
          <ul className="space-y-1 text-sm">
            {contacts.filter((c) => c.accountId === current.id).map((c) => (
              <li key={c.id} className="flex justify-between"><span>{c.firstName} {c.lastName} · {c.role}</span><Badge>{c.leadStatus}</Badge></li>
            ))}
          </ul>
          <h3 className="mb-2 mt-5 text-sm font-semibold">Deals</h3>
          <ul className="space-y-1 text-sm">
            {deals.filter((d) => d.accountId === current.id).map((d) => (
              <li key={d.id} className="flex justify-between">
                <span>{d.title} <span className="text-muted">({stages.find((s) => s.id === d.stage)?.label})</span></span>
                <span>{money(d.value, currency)}</span>
              </li>
            ))}
          </ul>
        </Drawer>
      )}
      {editing && <AccountFormModal account={editing} onClose={() => { setEditing(null); setOpen(null); }} />}
      {creating && <AccountFormModal onClose={() => setCreating(false)} />}
    </>
  );
}
