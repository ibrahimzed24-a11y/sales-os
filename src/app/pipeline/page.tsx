'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, LayoutGrid, List, Plus } from 'lucide-react';
import { useStore, useUi } from '@/lib/store';
import { isOpen, isStale } from '@/lib/metrics';
import { cn, fmtDate, initials, money } from '@/lib/utils';
import { Badge, Button, Card, Empty, inputCls, PageHeader } from '@/components/ui';
import { DealFormModal } from '@/components/forms';
<<<<<<< HEAD
import { toast } from 'sonner';
import { dbCall } from '@/lib/api';
=======
>>>>>>> origin/main
import type { Deal, StageId } from '@/types/sales-os';

export default function PipelinePage() {
  const deals = useStore((s) => s.deals);
  const accounts = useStore((s) => s.accounts);
  const stages = useStore((s) => s.settings.stages);
  const currency = useStore((s) => s.settings.currency);
  const locale = useStore((s) => s.settings.locale);
  const upsert = useStore((s) => s.upsert);
  const focus = useUi((s) => s.focus);
  const setFocus = useUi((s) => s.setFocus);

  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Deal | null>(null);
  const [creating, setCreating] = useState<StageId | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<StageId | null>(null);

  useEffect(() => {
    if (focus?.kind === 'deal') {
      const d = useStore.getState().deals.find((x) => x.id === focus.id);
      if (d) setEditing(d);
      setFocus(null);
    }
  }, [focus, setFocus]);

  const accName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—';
  const fm = (n: number) => money(n, currency, locale);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return deals.filter((d) => !needle || `${d.title} ${accName(d.accountId)}`.toLowerCase().includes(needle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals, q, accounts]);

<<<<<<< HEAD
  const moveTo = async (stage: StageId) => {
    const deal = deals.find((d) => d.id === dragId);
    const cfg = stages.find((s) => s.id === stage);
    if (!deal || !cfg || deal.stage === stage) {
      setDragId(null);
      setOverStage(null);
      return;
    }

    // Optimistic update
    const previous = { ...deal };
    upsert('deals', { ...deal, stage, probability: cfg.probability, updatedAt: new Date().toISOString() });
    setDragId(null);
    setOverStage(null);

    // Persist to server with rollback on failure
    try {
      await dbCall('POST', '/api/db/deals', { item: { ...deal, stage, probability: cfg.probability, updatedAt: new Date().toISOString() } }, { silent: true });
    } catch (e) {
      // Rollback
      upsert('deals', previous);
      toast.error('Failed to move deal. Changes reverted.');
      console.error(e);
    }
=======
  const moveTo = (stage: StageId) => {
    const deal = deals.find((d) => d.id === dragId);
    const cfg = stages.find((s) => s.id === stage);
    if (deal && cfg && deal.stage !== stage) {
      upsert('deals', { ...deal, stage, probability: cfg.probability, updatedAt: new Date().toISOString() });
    }
    setDragId(null);
    setOverStage(null);
>>>>>>> origin/main
  };

  return (
    <>
      <PageHeader
        title="Deal Pipeline"
        subtitle={`${filtered.filter(isOpen).length} open deals`}
        actions={
          <>
            <input className={cn(inputCls, 'w-48')} placeholder="Search deals..." value={q} onChange={(e) => setQ(e.target.value)} />
            <Button variant={view === 'kanban' ? 'primary' : 'outline'} onClick={() => setView('kanban')}>
              <LayoutGrid size={14} /> Board
            </Button>
            <Button variant={view === 'list' ? 'primary' : 'outline'} onClick={() => setView('list')}>
              <List size={14} /> List
            </Button>
            <Button onClick={() => setCreating('lead_in')}>
              <Plus size={14} /> New deal
            </Button>
          </>
        }
      />

      {view === 'kanban' ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stages.map((s) => {
            const list = filtered.filter((d) => d.stage === s.id);
            const total = list.reduce((a, d) => a + d.value, 0);
            const weighted = list.reduce((a, d) => a + (d.value * d.probability) / 100, 0);
            return (
              <div
                key={s.id}
                data-testid={`col-${s.id}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverStage(s.id);
                }}
                onDragLeave={() => setOverStage(null)}
                onDrop={() => moveTo(s.id)}
                className={cn(
                  'w-64 shrink-0 rounded-lg border bg-panel p-2',
                  overStage === s.id ? 'border-brand' : 'border-line',
                )}
              >
                <div className="mb-2 px-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{s.label}</span>
                    <Badge>{list.length}</Badge>
                  </div>
                  <p className="text-xs text-muted">
                    {fm(total)} · weighted {fm(weighted)}
                  </p>
                </div>
                <div className="space-y-2">
                  {list.map((d) => (
                    <div
                      key={d.id}
                      draggable
                      onDragStart={() => setDragId(d.id)}
                      onClick={() => setEditing(d)}
                      className="cursor-grab rounded-md border border-line bg-bg p-2.5 text-sm hover:border-brand"
                    >
                      <p className="font-medium">{d.title}</p>
                      <p className="text-xs text-muted">{accName(d.accountId)}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="font-semibold">{fm(d.value)}</span>
                        <Badge tone="violet">{d.probability}%</Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted">
                        <span>Close {fmtDate(d.expectedCloseDate)}</span>
                        <span title={d.owner} className="flex h-5 w-5 items-center justify-center rounded-full bg-raised text-[10px] text-fg">
                          {initials(d.owner)}
                        </span>
                      </div>
                      {isStale(d) && (
                        <div className="mt-2">
                          <Badge tone="amber">
                            <AlertTriangle size={11} className="mr-1" /> Stale deal
                          </Badge>
                        </div>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setCreating(s.id)} className="w-full rounded-md border border-dashed border-line py-1.5 text-xs text-muted hover:text-fg">
                    + Add deal
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-x-auto">
          {filtered.length === 0 ? (
            <Empty text="No deals found" />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  {['Deal', 'Account', 'Stage', 'Value', 'Prob.', 'Close', 'Owner'].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} onClick={() => setEditing(d)} className="cursor-pointer border-t border-line hover:bg-raised">
                    <td className="px-3 py-2 font-medium">{d.title}{isStale(d) && <span className="ml-2"><Badge tone="amber">Stale</Badge></span>}</td>
                    <td className="px-3 py-2">{accName(d.accountId)}</td>
                    <td className="px-3 py-2">{stages.find((s) => s.id === d.stage)?.label}</td>
                    <td className="px-3 py-2">{fm(d.value)}</td>
                    <td className="px-3 py-2">{d.probability}%</td>
                    <td className="px-3 py-2">{fmtDate(d.expectedCloseDate)}</td>
                    <td className="px-3 py-2">{d.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {editing && <DealFormModal deal={editing} onClose={() => setEditing(null)} />}
      {creating && <DealFormModal defaultStage={creating} onClose={() => setCreating(null)} />}
    </>
  );
}
