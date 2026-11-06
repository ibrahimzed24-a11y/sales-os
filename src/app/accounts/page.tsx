'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore, useUi } from '@/lib/store';
import { cn, money } from '@/lib/utils';
import { Badge, Button, Card, Drawer, Empty, inputCls, PageHeader } from '@/components/ui';
import { AccountFormModal } from '@/components/forms';
import type { Account } from '@/types/sales-os';

export default function AccountsPage() {
  const accounts = useStore((s) => s.accounts);
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
