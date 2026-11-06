import type { Contact, Deal, StageConfig } from '@/types/sales-os';

export const isOpen = (d: Deal): boolean => d.stage !== 'closed_won' && d.stage !== 'closed_lost';

export const isStale = (d: Deal): boolean =>
  isOpen(d) && Date.now() - new Date(d.updatedAt).getTime() > 7 * 86400000;

export interface Kpis {
  pipelineValue: number;
  weighted: number;
  wonMtd: number;
  wonQtd: number;
  winRate: number;
  avgDeal: number;
  activeLeads: number;
}

export function computeKpis(deals: Deal[], contacts: Contact[]): Kpis {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).getTime();
  const open = deals.filter(isOpen);
  const won = deals.filter((d) => d.stage === 'closed_won');
  const lost = deals.filter((d) => d.stage === 'closed_lost');
  const sum = (list: Deal[]) => list.reduce((a, d) => a + d.value, 0);
  const closedCount = won.length + lost.length;
  return {
    pipelineValue: sum(open),
    weighted: open.reduce((a, d) => a + (d.value * d.probability) / 100, 0),
    wonMtd: sum(won.filter((d) => new Date(d.updatedAt).getTime() >= monthStart)),
    wonQtd: sum(won.filter((d) => new Date(d.updatedAt).getTime() >= quarterStart)),
    winRate: closedCount === 0 ? 0 : (won.length / closedCount) * 100,
    avgDeal: won.length === 0 ? (open.length ? sum(open) / open.length : 0) : sum(won) / won.length,
    activeLeads: contacts.filter((c) => c.leadStatus !== 'Unqualified').length,
  };
}

export function forecastByMonth(deals: Deal[], months = 6): { month: string; weighted: number; total: number }[] {
  const now = new Date();
  const out: { month: string; weighted: number; total: number }[] = [];
  for (let i = 0; i < months; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
    const inMonth = deals.filter((d) => {
      const t = new Date(d.expectedCloseDate).getTime();
      return isOpen(d) && t >= start.getTime() && t < end.getTime();
    });
    out.push({
      month: start.toLocaleDateString('en-US', { month: 'short' }),
      total: inMonth.reduce((a, d) => a + d.value, 0),
      weighted: Math.round(inMonth.reduce((a, d) => a + (d.value * d.probability) / 100, 0)),
    });
  }
  return out;
}

export function funnel(deals: Deal[], stages: StageConfig[]): { stage: string; count: number; value: number }[] {
  return stages
    .filter((s) => s.id !== 'closed_lost')
    .map((s) => {
      const list = deals.filter((d) => d.stage === s.id);
      return { stage: s.label, count: list.length, value: list.reduce((a, d) => a + d.value, 0) };
    });
}

export function velocity(deals: Deal[], stages: StageConfig[]): { stage: string; days: number }[] {
  return stages
    .filter((s) => s.id !== 'closed_won' && s.id !== 'closed_lost')
    .map((s) => {
      const list = deals.filter((d) => d.stage === s.id);
      const total = list.reduce((a, d) => a + Math.max(0, (Date.now() - new Date(d.updatedAt).getTime()) / 86400000), 0);
      return { stage: s.label, days: list.length ? Math.round((total / list.length) * 10) / 10 : 0 };
    });
}
