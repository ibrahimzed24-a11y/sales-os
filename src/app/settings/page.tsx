'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { cn, download, toCSV } from '@/lib/utils';
import { Button, Card, inputCls, PageHeader } from '@/components/ui';
import type { Entities } from '@/types/sales-os';

export default function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const seedDemo = useStore((s) => s.seedDemo);
  const clearAll = useStore((s) => s.clearAll);
  const [msg, setMsg] = useState('');

  const exportJson = () => {
    const s = useStore.getState();
    const data: Entities = {
      accounts: s.accounts,
      contacts: s.contacts,
      deals: s.deals,
      activities: s.activities,
      products: s.products,
      quotes: s.quotes,
      playbooks: s.playbooks,
    };
    download('sales-os-backup.json', JSON.stringify({ settings: s.settings, ...data }, null, 2), 'application/json');
  };

  const exportDealsCsv = () => {
    const s = useStore.getState();
    download(
      'deals.csv',
      toCSV(s.deals.map((d) => ({ title: d.title, stage: d.stage, value: d.value, probability: d.probability, expectedCloseDate: d.expectedCloseDate.slice(0, 10), owner: d.owner }))),
      'text/csv',
    );
  };

  const setStage = (id: string, patch: { label?: string; probability?: number }) =>
    updateSettings({ stages: settings.stages.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  return (
    <>
      <PageHeader title="Settings" subtitle="Workspace configuration" />
      {msg && <p className="mb-3 rounded-md bg-emerald-500/15 px-3 py-2 text-sm text-emerald-500">{msg}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Appearance & locale</h2>
          <div className="space-y-3 text-sm">
            <label className="block"><span className="mb-1 block text-muted">Theme</span>
              <select className={inputCls} value={settings.theme} onChange={(e) => updateSettings({ theme: e.target.value as 'dark' | 'light' })}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
            <label className="block"><span className="mb-1 block text-muted">Currency</span>
              <select className={inputCls} value={settings.currency} onChange={(e) => updateSettings({ currency: e.target.value })}>
                {['USD', 'EUR', 'GBP', 'EGP', 'SAR', 'AED'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="block"><span className="mb-1 block text-muted">Locale</span>
              <select className={inputCls} value={settings.locale} onChange={(e) => updateSettings({ locale: e.target.value })}>
                {['en-US', 'en-GB', 'de-DE', 'fr-FR', 'ar-EG'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Pipeline stages</h2>
          <div className="space-y-2">
            {settings.stages.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <input className={cn(inputCls, 'flex-1')} aria-label={`${s.id} label`} value={s.label} onChange={(e) => setStage(s.id, { label: e.target.value })} />
                <input className={cn(inputCls, 'w-20')} type="number" min={0} max={100} aria-label={`${s.id} probability`} value={s.probability} onChange={(e) => setStage(s.id, { probability: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} />
                <span className="text-sm text-muted">%</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Data management</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportJson}>Export JSON backup</Button>
            <Button variant="outline" onClick={exportDealsCsv}>Export deals CSV</Button>
            <Button variant="outline" onClick={() => { if (window.confirm('Replace all data with demo data?')) { seedDemo(); setMsg('Demo data restored.'); } }}>Reset to Demo Data</Button>
            <Button variant="danger" onClick={() => { if (window.confirm('Delete ALL data in this workspace?')) { clearAll(); setMsg('Workspace cleared.'); } }}>Clear All Data</Button>
          </div>
          <p className="mt-3 text-xs text-muted">Data is stored in this browser. A PostgreSQL schema (prisma/schema.prisma) is included for connecting a cloud database via DATABASE_URL.</p>
        </Card>
      </div>
    </>
  );
}
