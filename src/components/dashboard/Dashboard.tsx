'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useStore } from '@/lib/store';
import { computeKpis, forecastByMonth, funnel, isOpen, isStale, velocity } from '@/lib/metrics';
import { fmtDate, money } from '@/lib/utils';
import { Badge, Card, PageHeader } from '@/components/ui';

export function Dashboard() {
  const deals = useStore((s) => s.deals);
  const contacts = useStore((s) => s.contacts);
  const activities = useStore((s) => s.activities);
  const stages = useStore((s) => s.settings.stages);
  const currency = useStore((s) => s.settings.currency);
  const locale = useStore((s) => s.settings.locale);

  const k = useMemo(() => computeKpis(deals, contacts), [deals, contacts]);
  const forecast = useMemo(() => forecastByMonth(deals), [deals]);
  const funnelData = useMemo(() => funnel(deals, stages), [deals, stages]);
  const vel = useMemo(() => velocity(deals, stages), [deals, stages]);
  const fm = (n: number) => money(n, currency, locale, true);

  const today = new Date().toISOString().slice(0, 10);
  const pending = activities.filter((a) => a.status !== 'completed');
  const overdue = pending.filter((a) => a.dueDate.slice(0, 10) < today);
  const dueToday = pending.filter((a) => a.dueDate.slice(0, 10) === today);
  const atRisk = deals.filter((d) => isOpen(d) && (isStale(d) || d.probability >= 60 && d.value >= 60000 && isStale(d)));

  const cards: [string, string, string][] = [
    ['Total pipeline', fm(k.pipelineValue), `Weighted ${fm(k.weighted)}`],
    ['Closed won (MTD)', fm(k.wonMtd), `QTD ${fm(k.wonQtd)}`],
    ['Win rate', `${k.winRate.toFixed(0)}%`, 'Won / closed deals'],
    ['Average deal size', fm(k.avgDeal), 'Across won deals'],
    ['Active leads', String(k.activeLeads), 'Excluding unqualified'],
  ];

  const tick = { fontSize: 12, fill: 'rgb(148 163 184)' };
  const tip = { backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0' };

  return (
    <>
      <PageHeader title="Command Center" subtitle="Your revenue at a glance" />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map(([label, value, sub]) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold" data-testid="kpi-value">{value}</p>
            <p className="mt-0.5 text-xs text-muted">{sub}</p>
          </Card>
        ))}
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Revenue forecast</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis dataKey="month" tick={tick} />
                <YAxis tick={tick} tickFormatter={(v: number) => fm(v)} width={60} />
                <Tooltip contentStyle={tip} formatter={(v) => money(Number(v), currency, locale)} />
                <Bar dataKey="total" name="Pipeline" fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="weighted" name="Weighted" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Pipeline conversion funnel</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={funnelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis dataKey="stage" tick={{ ...tick, fontSize: 10 }} />
                <YAxis tick={tick} tickFormatter={(v: number) => fm(v)} width={60} />
                <Tooltip contentStyle={tip} formatter={(v) => money(Number(v), currency, locale)} />
                <Area type="monotone" dataKey="value" name="Value" stroke="#818cf8" fill="#6366f1" fillOpacity={0.35} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Deal velocity (avg days since last update, by stage)</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vel} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis type="number" tick={tick} />
                <YAxis type="category" dataKey="stage" tick={{ ...tick, fontSize: 11 }} width={120} />
                <Tooltip contentStyle={tip} />
                <Bar dataKey="days" name="Days" fill="#f59e0b" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Today&apos;s focus</h2>
          <FocusGroup title={`Overdue follow-ups (${overdue.length})`}>
            {overdue.slice(0, 4).map((a) => (
              <li key={a.id} className="flex justify-between text-sm">
                <span>{a.subject}</span>
                <Badge tone="red">{fmtDate(a.dueDate)}</Badge>
              </li>
            ))}
          </FocusGroup>
          <FocusGroup title={`Scheduled today (${dueToday.length})`}>
            {dueToday.slice(0, 4).map((a) => (
              <li key={a.id} className="flex justify-between text-sm">
                <span>{a.subject}</span>
                <Badge tone="blue">{a.type}</Badge>
              </li>
            ))}
          </FocusGroup>
          <FocusGroup title={`Deals at risk (${atRisk.length})`}>
            {atRisk.slice(0, 4).map((d) => (
              <li key={d.id} className="flex justify-between text-sm">
                <Link href="/pipeline" className="hover:underline">{d.title}</Link>
                <Badge tone="amber">Stale · {fm(d.value)}</Badge>
              </li>
            ))}
          </FocusGroup>
        </Card>
      </div>
    </>
  );
}

function FocusGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}
