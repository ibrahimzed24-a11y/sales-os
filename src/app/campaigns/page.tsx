'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { cn, fmtDate, uid } from '@/lib/utils';
import { Badge, Button, Card, Drawer, Empty, FormModal, inputCls, PageHeader } from '@/components/ui';
import { toast } from 'sonner';
import { LEAD_STATUSES, REPS, SOURCES } from '@/components/forms';
import { Pager, useSender, webmailLink, renderTpl, useDebounced, useList } from '@/components/data';
import { dbCall } from '@/lib/api';
import type { Contact } from '@/types/sales-os';

type Aud = { leadStatus?: string; source?: string; owner?: string; tag?: string };
type Campaign = { id: string; name: string; status: string; subject: string; templateId: string; audience: Aud; dailyLimit: number; notes: string; createdAt: string };
type Template = { id: string; name: string; subject: string; body: string; createdAt: string };
type Log = { id: string; campaignId: string; contactId: string; toEmail: string; subject: string; body: string; status: string; preparedAt: string | null; sentAt: string | null; createdAt: string };
type CRow = Contact & { accountName: string };

const tone = (s: string) => (s === 'sent' ? 'green' : s === 'failed' ? 'red' : s === 'ready' || s === 'queued' ? 'blue' : 'amber');
const audParams = (a: Aud): Record<string, string> => {
  const o: Record<string, string> = {};
  if (a.leadStatus) o.leadStatus = a.leadStatus;
  if (a.source) o.source = a.source;
  if (a.owner) o.owner = a.owner;
  if (a.tag) o.tag = a.tag;
  return o;
};
const opts = (xs: string[], any = 'Any') => [{ value: '', label: any }, ...xs.map((x) => ({ value: x, label: x }))];

function CampaignDrawer({ c, templates, onClose, onEdit, onChanged }: { c: Campaign; templates: Template[]; onClose: () => void; onEdit: () => void; onChanged: () => void }) {
  const [info, setInfo] = useState({ audience: 0, logs: 0, sent: 0 });
  const [sample, setSample] = useState<CRow | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const tpl = templates.find((t) => t.id === c.templateId);
  const sender = useSender();

  useEffect(() => {
    const ap = new URLSearchParams({ ...audParams(c.audience ?? {}), hasEmail: '1', pageSize: '1' }).toString();
    dbCall<{ rows: CRow[]; total: number }>('GET', '/api/db/contacts?' + ap).then((r) => { setSample(r.rows[0] ?? null); setInfo((i) => ({ ...i, audience: r.total })); }).catch(() => undefined);
    dbCall<{ total: number }>('GET', '/api/db/email_logs?pageSize=1&campaignId=' + c.id).then((r) => setInfo((i) => ({ ...i, logs: r.total }))).catch(() => undefined);
    dbCall<{ total: number }>('GET', '/api/db/email_logs?pageSize=1&status=sent&campaignId=' + c.id).then((r) => setInfo((i) => ({ ...i, sent: r.total }))).catch(() => undefined);
  }, [c, tick]);

  const prepare = async () => {
    if (!tpl) { setMsg('Choose a template first (Edit campaign).'); return; }
    setBusy(true);
    let n = 0;
    const now = new Date().toISOString();
    try {
      for (let p = 1; p <= 10; p++) {
        const r = await dbCall<{ rows: CRow[] }>('GET', '/api/db/contacts?' + new URLSearchParams({ ...audParams(c.audience ?? {}), hasEmail: '1', all: '1', page: String(p) }).toString());
        if (!r.rows.length) break;
        const items = r.rows.map((ct) => ({
          id: 'log_' + c.id + '_' + ct.id, campaignId: c.id, contactId: ct.id, toEmail: ct.email,
          subject: renderTpl(c.subject || tpl.subject, ct, ct.accountName), body: renderTpl(tpl.body, ct, ct.accountName),
          status: 'prepared', preparedAt: now, createdAt: now,
        }));
        await dbCall('POST', '/api/db/email_logs?ignore=1', { items });
        n += items.length;
        if (r.rows.length < 1000) break;
      }
      setMsg('Prepared ' + n + ' email log rows (status: prepared). No email was sent.');
    } catch (e) {
      setMsg('Failed: ' + (e instanceof Error ? e.message : 'error'));
    }
    setBusy(false);
    setTick((t) => t + 1);
  };

  const setStatus = async (status: string) => {
    await dbCall('PATCH', '/api/db/campaigns', { ids: [c.id], patch: { status } });
    onChanged();
    onClose();
  };

  return (
    <Drawer title={c.name} onClose={onClose}>
      <div className="flex items-center gap-2 text-sm"><Badge tone={tone(c.status)}>{c.status}</Badge><span className="text-muted">Created {fmtDate(c.createdAt)}</span></div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <p>From: {sender}</p>
        <p>Template: {tpl?.name ?? 'not set'}</p>
        <p>Daily limit: {c.dailyLimit}</p>
        <p>Audience (with email): {info.audience.toLocaleString()}</p>
        <p>Prepared logs: {info.logs.toLocaleString()}</p>
        <p>Sent logs: {info.sent.toLocaleString()}</p>
        <p>Audience filter: {Object.entries(c.audience ?? {}).filter((e) => e[1]).map((e) => e[0] + '=' + e[1]).join(', ') || 'all contacts'}</p>
      </div>
      {tpl && sample && (
        <div className="mt-4 rounded border border-line p-3 text-sm">
          <p className="text-xs text-muted">From: {sender}</p>
          <p className="text-xs text-muted">Preview for {sample.firstName} {sample.lastName}</p>
          <p className="font-medium">{renderTpl(c.subject || tpl.subject, sample, sample.accountName)}</p>
          <p className="whitespace-pre-wrap text-muted">{renderTpl(tpl.body, sample, sample.accountName)}</p>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={onEdit}>Edit</Button>
        <Button disabled={busy} onClick={() => void prepare()}>{busy ? 'Preparing...' : 'Prepare send list (does not send)'}</Button>
        {c.status === 'draft' && <Button variant="outline" onClick={() => void setStatus('ready')}>Mark ready</Button>}
        {c.status === 'ready' && <Button variant="outline" onClick={() => void setStatus('draft')}>Back to draft</Button>}
      </div>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
      <p className="mt-4 rounded border border-line p-3 text-xs text-muted">
        Sending is not enabled in this app. Campaigns stay draft/ready and nothing is emailed. Prepared rows appear in Email Logs, where each one can be opened as a Hostinger Webmail compose window and sent manually from {sender}. Log in to that mailbox in Hostinger Webmail first.
      </p>
    </Drawer>
  );
}

export default function CampaignsPage() {
  const [tab, setTab] = useState<'campaigns' | 'templates' | 'logs'>('campaigns');
  const [openC, setOpenC] = useState<Campaign | null>(null);
  const [editC, setEditC] = useState<Campaign | 'new' | null>(null);
  const [editT, setEditT] = useState<Template | 'new' | null>(null);
  const [lq, setLq] = useState('');
  const [lStatus, setLStatus] = useState('');
  const [lCamp, setLCamp] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const dq = useDebounced(lq);

  const sender = useSender();
  const camps = useList<Campaign>('campaigns', { all: '1' });
  const tpls = useList<Template>('email_templates', { all: '1' });
  const lp: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
  if (dq) lp.q = dq;
  if (lStatus) lp.status = lStatus;
  if (lCamp) lp.campaignId = lCamp;
  const logs = useList<Log>('email_logs', lp);
  const cName = (id: string) => camps.rows.find((c) => c.id === id)?.name ?? '-';

  const saveC = async (v: Record<string, string>) => {
    const old = editC && editC !== 'new' ? editC : null;
    try {
      await dbCall('POST', '/api/db/campaigns', { item: {
        id: old?.id ?? uid('cmp'), name: v.name, status: old?.status ?? 'draft', subject: v.subject, templateId: v.templateId,
        audience: { leadStatus: v.leadStatus, source: v.source, owner: v.owner, tag: v.tag }, dailyLimit: Number(v.dailyLimit) || 40, notes: v.notes ?? '',
      } });
      setEditC(null); setOpenC(null); camps.reload();
      toast.success('Campaign saved');
    } catch (err) {
      toast.error('Failed to save campaign');
      console.error(err);
    }
  };
  const saveT = async (v: Record<string, string>) => {
    const old = editT && editT !== 'new' ? editT : null;
    try {
      await dbCall('POST', '/api/db/email_templates', { item: { id: old?.id ?? uid('tpl'), name: v.name, subject: v.subject, body: v.body } });
      setEditT(null); tpls.reload();
      toast.success('Template saved');
    } catch (err) {
      toast.error('Failed to save template');
      console.error(err);
    }
  };
  const delC = async (c: Campaign) => {
    try {
      await dbCall('DELETE', '/api/db/campaigns?id=' + encodeURIComponent(c.id));
      setEditC(null); setOpenC(null); camps.reload();
      toast.success('Campaign deleted');
    } catch (err) {
      toast.error('Failed to delete campaign');
      console.error(err);
    }
  };
  const delT = async (x: Template) => {
    try {
      await dbCall('DELETE', '/api/db/email_templates?id=' + encodeURIComponent(x.id));
      setEditT(null); tpls.reload();
      toast.success('Template deleted');
    } catch (err) {
      toast.error('Failed to delete template');
      console.error(err);
    }
  };
  const markLog = async (l: Log, status: string) => {
    try {
      await dbCall('PATCH', '/api/db/email_logs', { ids: [l.id], patch: { status, sentAt: status === 'sent' ? new Date().toISOString() : null } });
      logs.reload();
    } catch (err) {
      toast.error('Failed to update email log');
      console.error(err);
    }
  };

  const ec = editC && editC !== 'new' ? editC : null;
  const et = editT && editT !== 'new' ? editT : null;

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle={'Plan campaigns, templates and email logs. Nothing is sent from here. Default From: ' + sender}
        actions={
          <>
            {tab === 'campaigns' && <Button onClick={() => setEditC('new')}><Plus size={14} /> New campaign</Button>}
            {tab === 'templates' && <Button onClick={() => setEditT('new')}><Plus size={14} /> New template</Button>}
          </>
        }
      />
      <p className="mb-2 text-xs text-muted">Default sender (From): <span className="font-medium text-fg">{sender}</span> · manual sending via Hostinger Webmail</p>
      <div className="mb-3 flex gap-2">
        {(['campaigns', 'templates', 'logs'] as const).map((t) => (
          <Button key={t} variant={tab === t ? 'primary' : 'outline'} onClick={() => setTab(t)}>{t === 'logs' ? 'Email Logs' : t === 'templates' ? 'Templates' : 'Campaigns'}</Button>
        ))}
      </div>

      {tab === 'campaigns' && (
        <Card className="overflow-x-auto">
          {camps.rows.length === 0 ? <Empty text="No campaigns yet" /> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted"><tr>{['Name', 'Status', 'Template', 'Daily limit', 'Created'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {camps.rows.map((c) => (
                  <tr key={c.id} className="cursor-pointer border-t border-line hover:bg-raised" onClick={() => setOpenC(c)}>
                    <td className="px-3 py-2 font-medium">{c.name}</td>
                    <td className="px-3 py-2"><Badge tone={tone(c.status)}>{c.status}</Badge></td>
                    <td className="px-3 py-2">{tpls.rows.find((t) => t.id === c.templateId)?.name ?? '-'}</td>
                    <td className="px-3 py-2">{c.dailyLimit}</td>
                    <td className="px-3 py-2">{fmtDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'templates' && (
        <Card className="overflow-x-auto">
          {tpls.rows.length === 0 ? <Empty text="No templates yet. Variables: {{first_name}} {{last_name}} {{full_name}} {{company}} {{role}}" /> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted"><tr>{['Name', 'Subject', 'Created'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {tpls.rows.map((t) => (
                  <tr key={t.id} className="cursor-pointer border-t border-line hover:bg-raised" onClick={() => setEditT(t)}>
                    <td className="px-3 py-2 font-medium">{t.name}</td><td className="px-3 py-2">{t.subject}</td><td className="px-3 py-2">{fmtDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'logs' && (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <input className={cn(inputCls, 'w-56')} placeholder="Search recipient or subject..." value={lq} onChange={(e) => { setLq(e.target.value); setPage(1); }} />
            <select className={cn(inputCls, 'w-44')} value={lCamp} onChange={(e) => { setLCamp(e.target.value); setPage(1); }}>
              <option value="">All campaigns</option>
              {camps.rows.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={cn(inputCls, 'w-40')} value={lStatus} onChange={(e) => { setLStatus(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              {['prepared', 'queued', 'sent', 'failed', 'skipped'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <Card className="overflow-x-auto">
            {logs.rows.length === 0 ? <Empty text={logs.loading ? 'Loading...' : 'No email logs'} /> : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted"><tr>{['From', 'To', 'Subject', 'Campaign', 'Status', 'Prepared', 'Actions'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {logs.rows.map((l) => (
                    <tr key={l.id} className="border-t border-line">
                      <td className="px-3 py-2">{sender}</td>
                      <td className="px-3 py-2">{l.toEmail}</td>
                      <td className="px-3 py-2">{l.subject}</td>
                      <td className="px-3 py-2">{cName(l.campaignId)}</td>
                      <td className="px-3 py-2"><Badge tone={tone(l.status)}>{l.status}</Badge></td>
                      <td className="px-3 py-2">{fmtDate(l.preparedAt)}</td>
                      <td className="flex gap-2 px-3 py-2 text-xs">
                        <a className="text-brand underline" target="_blank" rel="noreferrer" href={webmailLink(l.toEmail, l.subject, l.body)}>Open in Hostinger Webmail</a>
                        {l.status !== 'sent' && <button className="underline" onClick={() => void markLog(l, 'sent')}>Mark sent</button>}
                        {l.status === 'prepared' && <button className="underline" onClick={() => void markLog(l, 'skipped')}>Skip</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Pager page={page} pageSize={pageSize} total={logs.total} onPage={setPage} onSize={(n) => { setPageSize(n); setPage(1); }} />
          </Card>
        </>
      )}

      {openC && <CampaignDrawer c={openC} templates={tpls.rows} onClose={() => setOpenC(null)} onEdit={() => setEditC(openC)} onChanged={camps.reload} />}
      {editC && (
        <FormModal
          title={ec ? 'Edit campaign' : 'New campaign'}
          initial={{ name: ec?.name ?? '', subject: ec?.subject ?? '', templateId: ec?.templateId ?? '', leadStatus: ec?.audience?.leadStatus ?? '', source: ec?.audience?.source ?? '', owner: ec?.audience?.owner ?? '', tag: ec?.audience?.tag ?? '', dailyLimit: String(ec?.dailyLimit ?? 40), notes: ec?.notes ?? '' }}
          fields={[
            { key: 'name', label: 'Campaign name (From: ' + sender + ')', required: true },
            { key: 'subject', label: 'Subject (optional, overrides template)' },
            { key: 'templateId', label: 'Email template', type: 'select', options: opts(tpls.rows.map((t) => t.id), 'Choose...').map((o) => ({ value: o.value, label: tpls.rows.find((t) => t.id === o.value)?.name ?? o.label })) },
            { key: 'leadStatus', label: 'Audience: status', type: 'select', options: opts(LEAD_STATUSES) },
            { key: 'source', label: 'Audience: source', type: 'select', options: opts(SOURCES) },
            { key: 'owner', label: 'Audience: owner', type: 'select', options: opts(REPS) },
            { key: 'tag', label: 'Audience: tag' },
            { key: 'dailyLimit', label: 'Daily send limit', type: 'number' },
            { key: 'notes', label: 'Notes', type: 'textarea' },
          ]}
          onSubmit={(v) => void saveC(v)}
          onDelete={ec ? () => void delC(ec) : undefined}
          onClose={() => setEditC(null)}
        />
      )}
      {editT && (
        <FormModal
          title={et ? 'Edit template' : 'New template'}
          initial={{ name: et?.name ?? '', subject: et?.subject ?? '', body: et?.body ?? '' }}
          fields={[
            { key: 'name', label: 'Template name', required: true },
            { key: 'subject', label: 'Subject (supports {{first_name}}, {{company}}) · From: ' + sender },
            { key: 'body', label: 'Body (supports {{first_name}}, {{last_name}}, {{company}}, {{role}})', type: 'textarea' },
          ]}
          onSubmit={(v) => void saveT(v)}
          onDelete={et ? () => void delT(et) : undefined}
          onClose={() => setEditT(null)}
        />
      )}
    </>
  );
}
