'use client';

import { useState } from 'react';
import { Copy, Plus } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn, uid } from '@/lib/utils';
import { toast } from 'sonner';
import { dbCall } from '@/lib/api';
import { Badge, Button, Card, FormModal, inputCls, PageHeader } from '@/components/ui';
import type { PlaybookCategory, PlaybookItem } from '@/types/sales-os';

const CATS: PlaybookCategory[] = ['Script', 'Objection', 'Template', 'Framework'];

export default function PlaybooksPage() {
  const playbooks = useStore((s) => s.playbooks);
  const upsert = useStore((s) => s.upsert);
  const remove = useStore((s) => s.remove);
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [firstName, setFirstName] = useState('');
  const [company, setCompany] = useState('');
  const [copied, setCopied] = useState('');
  const [editing, setEditing] = useState<PlaybookItem | 'new' | null>(null);

  const rows = playbooks.filter(
    (p) => (!cat || p.category === cat) && (!q || `${p.title} ${p.content} ${p.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase())),
  );
  const fill = (text: string) =>
    text.replace(/\{\{first_name\}\}/g, firstName || '{{first_name}}').replace(/\{\{company\}\}/g, company || '{{company}}');

  const copy = async (p: PlaybookItem) => {
    await navigator.clipboard.writeText(fill(p.content));
    setCopied(p.id);
    setTimeout(() => setCopied(''), 1500);
  };

  return (
    <>
      <PageHeader
        title="Playbooks & Objection Handling"
        subtitle="Scripts, frameworks, email templates and battlecards"
        actions={<Button onClick={() => setEditing('new')}><Plus size={14} /> New playbook</Button>}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <input className={cn(inputCls, 'w-56')} placeholder="Search playbooks..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={cn(inputCls, 'w-36')} value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {CATS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input className={cn(inputCls, 'w-40')} placeholder="{{first_name}}" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <input className={cn(inputCls, 'w-40')} placeholder="{{company}}" value={company} onChange={(e) => setCompany(e.target.value)} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((p) => (
          <Card key={p.id} className="p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <Badge tone={p.category === 'Objection' ? 'red' : p.category === 'Script' ? 'blue' : p.category === 'Template' ? 'green' : 'violet'}>{p.category}</Badge>
                <h3 className="mt-1 font-semibold">{p.title}</h3>
              </div>
              <div className="flex gap-1">
                <Button variant="outline" onClick={() => void copy(p)}><Copy size={13} /> {copied === p.id ? 'Copied' : 'Copy'}</Button>
                <Button variant="ghost" onClick={() => setEditing(p)}>Edit</Button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm text-muted">{fill(p.content)}</pre>
            <div className="mt-2 flex flex-wrap gap-1">{p.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted">No playbooks found</p>}
      </div>
      {editing && (
        <FormModal
          title={editing === 'new' ? 'New playbook item' : 'Edit playbook item'}
          onClose={() => setEditing(null)}
          fields={[
            { key: 'category', label: 'Category', type: 'select', options: CATS.map((c) => ({ value: c, label: c })) },
            { key: 'title', label: 'Title', required: true },
            { key: 'tags', label: 'Tags (comma separated)' },
            { key: 'content', label: 'Content (use {{first_name}} and {{company}})', type: 'textarea', required: true },
          ]}
          initial={{
            category: editing === 'new' ? 'Script' : editing.category,
            title: editing === 'new' ? '' : editing.title,
            tags: editing === 'new' ? '' : editing.tags.join(', '),
            content: editing === 'new' ? '' : editing.content,
          }}
          onSubmit={(v) => {
            const item: PlaybookItem = {
              id: editing === 'new' ? uid('pb') : editing.id,
              category: v.category as PlaybookCategory,
              title: v.title,
              tags: v.tags.split(',').map((t) => t.trim()).filter(Boolean),
              content: v.content,
              updatedAt: new Date().toISOString(),
            };
            upsert('playbooks', item);
            void dbCall('POST', '/api/db/playbooks', { item }, { silent: true }).catch((err) => {
              toast.error('Failed to save playbook to server');
              console.error(err);
            });
            setEditing(null);
          }}
          onDelete={editing === 'new' ? undefined : async () => {
            try {
              await dbCall('DELETE', '/api/db/playbooks?id=' + encodeURIComponent(editing.id), undefined, { silent: true });
              remove('playbooks', editing.id);
              toast.success('Playbook deleted');
            } catch (err) {
              toast.error('Failed to delete playbook');
              console.error(err);
            }
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
