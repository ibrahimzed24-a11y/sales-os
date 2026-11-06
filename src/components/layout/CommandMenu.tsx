'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore, useUi } from '@/lib/store';
import { NAV } from '@/components/layout/Shell';

interface Item {
  id: string;
  label: string;
  hint: string;
  run: () => void;
}

export function CommandMenu() {
  const { palette, setPalette, setQuickAdd, setFocus } = useUi();
  const router = useRouter();
  const contacts = useStore((s) => s.contacts);
  const accounts = useStore((s) => s.accounts);
  const deals = useStore((s) => s.deals);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (palette) setQ('');
  }, [palette]);

  const items = useMemo<Item[]>(() => {
    const close = () => setPalette(false);
    const base: Item[] = [
      { id: 'new-deal', label: 'Create deal', hint: 'Action', run: () => { close(); setQuickAdd('deal'); } },
      { id: 'new-contact', label: 'Create contact', hint: 'Action', run: () => { close(); setQuickAdd('contact'); } },
      { id: 'new-task', label: 'Create task', hint: 'Action', run: () => { close(); setQuickAdd('task'); } },
      ...NAV.map((n) => ({ id: `nav-${n.href}`, label: `Go to ${n.label}`, hint: 'Navigate', run: () => { close(); router.push(n.href); } })),
    ];
    const needle = q.trim().toLowerCase();
    if (!needle) return base;
    const found: Item[] = [
      ...contacts
        .filter((c) => `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(needle))
        .slice(0, 5)
        .map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName}`, hint: 'Contact', run: () => { close(); setFocus({ kind: 'contact', id: c.id }); router.push('/contacts'); } })),
      ...accounts
        .filter((a) => `${a.name} ${a.domain}`.toLowerCase().includes(needle))
        .slice(0, 5)
        .map((a) => ({ id: a.id, label: a.name, hint: 'Account', run: () => { close(); setFocus({ kind: 'account', id: a.id }); router.push('/accounts'); } })),
      ...deals
        .filter((d) => d.title.toLowerCase().includes(needle))
        .slice(0, 5)
        .map((d) => ({ id: d.id, label: d.title, hint: 'Deal', run: () => { close(); setFocus({ kind: 'deal', id: d.id }); router.push('/pipeline'); } })),
    ];
    return [...found, ...base.filter((b) => b.label.toLowerCase().includes(needle))];
  }, [q, contacts, accounts, deals, router, setPalette, setQuickAdd, setFocus]);

  if (!palette) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-4 pt-24" onMouseDown={() => setPalette(false)}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-line bg-panel"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setPalette(false);
            if (e.key === 'Enter' && items[0]) items[0].run();
          }}
          placeholder="Search leads, deals, accounts or type a command..."
          className="w-full border-b border-line bg-transparent px-4 py-3 text-sm outline-none"
        />
        <ul className="max-h-80 overflow-y-auto p-1">
          {items.length === 0 && <li className="p-4 text-sm text-muted">No results</li>}
          {items.map((it) => (
            <li key={it.id}>
              <button onClick={it.run} className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-raised">
                <span>{it.label}</span>
                <span className="text-xs text-muted">{it.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
