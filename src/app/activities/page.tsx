'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn, fmtDate } from '@/lib/utils';
import { Badge, Button, Card, Empty, inputCls, PageHeader } from '@/components/ui';
import { ACTIVITY_TYPES, ActivityFormModal } from '@/components/forms';
import type { Activity, Priority } from '@/types/sales-os';

const prTone = (p: Priority) => (p === 'urgent' ? 'red' : p === 'high' ? 'amber' : p === 'medium' ? 'blue' : 'slate');

export default function ActivitiesPage() {
  const activities = useStore((s) => s.activities);
  const contacts = useStore((s) => s.contacts);
  const upsert = useStore((s) => s.upsert);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<Activity | null>(null);
  const [creating, setCreating] = useState<Partial<Activity> | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const effective = (a: Activity) => (a.status === 'pending' && a.dueDate.slice(0, 10) < today ? 'overdue' : a.status);
  const rows = activities
    .filter((a) => (!type || a.type === type) && (!status || effective(a) === status))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const who = (id: string) => {
    const c = contacts.find((x) => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : '';
  };

  const toggle = (a: Activity) => {
    const done = a.status !== 'completed';
    upsert('activities', { ...a, status: done ? 'completed' : 'pending' });
    const c = contacts.find((x) => x.id === a.contactId);
    if (done && c) upsert('contacts', { ...c, lastContactedAt: new Date().toISOString() });
  };

  return (
    <>
      <PageHeader
        title="Activities & Tasks"
        subtitle={`${rows.length} items`}
        actions={
          <>
            <select className={cn(inputCls, 'w-32')} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              {ACTIVITY_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <select className={cn(inputCls, 'w-36')} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option>pending</option>
              <option>overdue</option>
              <option>completed</option>
            </select>
            <Button variant="outline" onClick={() => setCreating({ type: 'call', status: 'completed', outcome: 'Connected' })}>Log call</Button>
            <Button variant="outline" onClick={() => setCreating({ type: 'meeting', status: 'completed' })}>Log meeting</Button>
            <Button onClick={() => setCreating({})}><Plus size={14} /> New task</Button>
          </>
        }
      />
      <Card>
        {rows.length === 0 ? (
          <Empty text="Nothing here yet" />
        ) : (
          <ul>
            {rows.map((a) => {
              const st = effective(a);
              return (
                <li key={a.id} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
                  <input type="checkbox" aria-label={`Complete ${a.subject}`} checked={a.status === 'completed'} onChange={() => toggle(a)} />
                  <button onClick={() => setEditing(a)} className="min-w-0 flex-1 text-left">
                    <p className={cn('truncate text-sm font-medium', a.status === 'completed' && 'text-muted line-through')}>{a.subject}</p>
                    <p className="text-xs text-muted">
                      {a.type} · due {fmtDate(a.dueDate)}{who(a.contactId) ? ` · ${who(a.contactId)}` : ''}{a.outcome ? ` · ${a.outcome}` : ''}
                    </p>
                  </button>
                  <Badge tone={prTone(a.priority)}>{a.priority}</Badge>
                  <Badge tone={st === 'overdue' ? 'red' : st === 'completed' ? 'green' : 'slate'}>{st}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {editing && <ActivityFormModal activity={editing} onClose={() => setEditing(null)} />}
      {creating && <ActivityFormModal preset={creating} onClose={() => setCreating(null)} />}
    </>
  );
}
