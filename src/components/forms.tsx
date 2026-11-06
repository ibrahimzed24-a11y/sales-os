'use client';

import { FormModal } from '@/components/ui';
import { useStore } from '@/lib/store';
import { dateInput, num, uid } from '@/lib/utils';
import type {
  Account,
  Activity,
  ActivityStatus,
  ActivityType,
  Contact,
  Deal,
  LeadSource,
  LeadStatus,
  Priority,
  StageId,
  Tier,
} from '@/types/sales-os';

export const REPS = ['Sara Ali', 'Omar Hassan', 'Lina Park'];
const opts = (list: string[]) => list.map((v) => ({ value: v, label: v }));
export const LEAD_STATUSES: LeadStatus[] = ['New', 'Contacted', 'Working', 'Qualified', 'Unqualified'];
export const SOURCES: LeadSource[] = ['Inbound', 'Outbound', 'Referral', 'Partner'];

export function DealFormModal({ deal, defaultStage, onClose }: { deal?: Deal; defaultStage?: StageId; onClose: () => void }) {
  const accounts = useStore((s) => s.accounts);
  const contacts = useStore((s) => s.contacts);
  const stages = useStore((s) => s.settings.stages);
  const currency = useStore((s) => s.settings.currency);
  const upsert = useStore((s) => s.upsert);
  const remove = useStore((s) => s.remove);
  const today = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  return (
    <FormModal
      title={deal ? 'Edit deal' : 'New deal'}
      onClose={onClose}
      fields={[
        { key: 'title', label: 'Title', required: true },
        { key: 'accountId', label: 'Account', type: 'select', required: true, options: [{ value: '', label: '— select —' }, ...accounts.map((a) => ({ value: a.id, label: a.name }))] },
        { key: 'primaryContactId', label: 'Primary contact', type: 'select', options: [{ value: '', label: '— none —' }, ...contacts.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))] },
        { key: 'stage', label: 'Stage', type: 'select', options: stages.map((s) => ({ value: s.id, label: s.label })) },
        { key: 'value', label: 'Value', type: 'number', required: true },
        { key: 'probability', label: 'Probability % (blank = stage default)', type: 'number' },
        { key: 'expectedCloseDate', label: 'Expected close date', type: 'date' },
        { key: 'owner', label: 'Owner', type: 'select', options: opts(REPS) },
        { key: 'lossReason', label: 'Loss reason (if lost)' },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      initial={{
        title: deal?.title ?? '',
        accountId: deal?.accountId ?? '',
        primaryContactId: deal?.primaryContactId ?? '',
        stage: deal?.stage ?? defaultStage ?? 'lead_in',
        value: String(deal?.value ?? ''),
        probability: deal ? String(deal.probability) : '',
        expectedCloseDate: dateInput(deal?.expectedCloseDate) || today,
        owner: deal?.owner ?? REPS[0],
        lossReason: deal?.lossReason ?? '',
        notes: deal?.notes ?? '',
      }}
      onSubmit={(v) => {
        const stage = v.stage as StageId;
        const cfg = stages.find((s) => s.id === stage);
        const now = new Date().toISOString();
        const next: Deal = {
          id: deal?.id ?? uid('deal'),
          title: v.title,
          accountId: v.accountId,
          primaryContactId: v.primaryContactId,
          stage,
          value: num(v.value),
          currency: deal?.currency ?? currency,
          probability: v.probability === '' ? (cfg?.probability ?? 0) : Math.min(100, Math.max(0, num(v.probability))),
          expectedCloseDate: v.expectedCloseDate,
          lossReason: v.lossReason || undefined,
          notes: v.notes,
          owner: v.owner,
          updatedAt: now,
          createdAt: deal?.createdAt ?? now,
        };
        upsert('deals', next);
        onClose();
      }}
      onDelete={
        deal
          ? () => {
              remove('deals', deal.id);
              onClose();
            }
          : undefined
      }
    />
  );
}

export function ContactFormModal({ contact, onClose }: { contact?: Contact; onClose: () => void }) {
  const accounts = useStore((s) => s.accounts);
  const upsert = useStore((s) => s.upsert);
  const remove = useStore((s) => s.remove);
  return (
    <FormModal
      title={contact ? 'Edit contact' : 'New contact'}
      onClose={onClose}
      fields={[
        { key: 'firstName', label: 'First name', required: true },
        { key: 'lastName', label: 'Last name', required: true },
        { key: 'email', label: 'Email', type: 'email' },
        { key: 'phone', label: 'Phone' },
        { key: 'role', label: 'Role' },
        { key: 'accountId', label: 'Account', type: 'select', options: [{ value: '', label: '— none —' }, ...accounts.map((a) => ({ value: a.id, label: a.name }))] },
        { key: 'leadStatus', label: 'Status', type: 'select', options: opts(LEAD_STATUSES) },
        { key: 'leadScore', label: 'Lead score (0-100)', type: 'number' },
        { key: 'source', label: 'Source', type: 'select', options: opts(SOURCES) },
        { key: 'owner', label: 'Owner', type: 'select', options: opts(REPS) },
        { key: 'tags', label: 'Tags (comma separated)' },
      ]}
      initial={{
        firstName: contact?.firstName ?? '',
        lastName: contact?.lastName ?? '',
        email: contact?.email ?? '',
        phone: contact?.phone ?? '',
        role: contact?.role ?? '',
        accountId: contact?.accountId ?? '',
        leadStatus: contact?.leadStatus ?? 'New',
        leadScore: String(contact?.leadScore ?? 50),
        source: contact?.source ?? 'Inbound',
        owner: contact?.owner ?? REPS[0],
        tags: contact?.tags.join(', ') ?? '',
      }}
      onSubmit={(v) => {
        const next: Contact = {
          id: contact?.id ?? uid('con'),
          accountId: v.accountId,
          firstName: v.firstName,
          lastName: v.lastName,
          email: v.email,
          phone: v.phone,
          role: v.role,
          leadStatus: v.leadStatus as LeadStatus,
          leadScore: Math.min(100, Math.max(0, num(v.leadScore))),
          source: v.source as LeadSource,
          tags: v.tags.split(',').map((t) => t.trim()).filter(Boolean),
          owner: v.owner,
          lastContactedAt: contact?.lastContactedAt ?? null,
          createdAt: contact?.createdAt ?? new Date().toISOString(),
        };
        upsert('contacts', next);
        onClose();
      }}
      onDelete={
        contact
          ? () => {
              remove('contacts', contact.id);
              onClose();
            }
          : undefined
      }
    />
  );
}

export function AccountFormModal({ account, onClose }: { account?: Account; onClose: () => void }) {
  const upsert = useStore((s) => s.upsert);
  const remove = useStore((s) => s.remove);
  return (
    <FormModal
      title={account ? 'Edit account' : 'New account'}
      onClose={onClose}
      fields={[
        { key: 'name', label: 'Company name', required: true },
        { key: 'domain', label: 'Domain' },
        { key: 'industry', label: 'Industry' },
        { key: 'size', label: 'Employees', type: 'number' },
        { key: 'annualRevenue', label: 'Annual revenue', type: 'number' },
        { key: 'tier', label: 'Tier', type: 'select', options: opts(['Enterprise', 'Mid-Market', 'SMB']) },
      ]}
      initial={{
        name: account?.name ?? '',
        domain: account?.domain ?? '',
        industry: account?.industry ?? '',
        size: String(account?.size ?? ''),
        annualRevenue: String(account?.annualRevenue ?? ''),
        tier: account?.tier ?? 'Mid-Market',
      }}
      onSubmit={(v) => {
        const next: Account = {
          id: account?.id ?? uid('acc'),
          name: v.name,
          domain: v.domain,
          industry: v.industry,
          size: num(v.size),
          annualRevenue: num(v.annualRevenue),
          tier: v.tier as Tier,
          createdAt: account?.createdAt ?? new Date().toISOString(),
        };
        upsert('accounts', next);
        onClose();
      }}
      onDelete={
        account
          ? () => {
              remove('accounts', account.id);
              onClose();
            }
          : undefined
      }
    />
  );
}

export const ACTIVITY_TYPES: ActivityType[] = ['call', 'email', 'meeting', 'task', 'note'];
export const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];
export const OUTCOMES = ['', 'Connected', 'Left Voicemail', 'No Answer'];

export function ActivityFormModal({
  activity,
  preset,
  onClose,
}: {
  activity?: Activity;
  preset?: Partial<Pick<Activity, 'type' | 'contactId' | 'dealId' | 'outcome' | 'status'>>;
  onClose: () => void;
}) {
  const contacts = useStore((s) => s.contacts);
  const deals = useStore((s) => s.deals);
  const upsert = useStore((s) => s.upsert);
  const remove = useStore((s) => s.remove);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <FormModal
      title={activity ? 'Edit activity' : 'New activity / task'}
      onClose={onClose}
      fields={[
        { key: 'type', label: 'Type', type: 'select', options: opts(ACTIVITY_TYPES) },
        { key: 'subject', label: 'Subject', required: true },
        { key: 'description', label: 'Notes', type: 'textarea' },
        { key: 'priority', label: 'Priority', type: 'select', options: opts(PRIORITIES) },
        { key: 'dueDate', label: 'Due date', type: 'date' },
        { key: 'status', label: 'Status', type: 'select', options: opts(['pending', 'completed']) },
        { key: 'outcome', label: 'Call outcome', type: 'select', options: OUTCOMES.map((o) => ({ value: o, label: o || '— n/a —' })) },
        { key: 'contactId', label: 'Contact', type: 'select', options: [{ value: '', label: '— none —' }, ...contacts.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))] },
        { key: 'dealId', label: 'Deal', type: 'select', options: [{ value: '', label: '— none —' }, ...deals.map((d) => ({ value: d.id, label: d.title }))] },
      ]}
      initial={{
        type: activity?.type ?? preset?.type ?? 'task',
        subject: activity?.subject ?? '',
        description: activity?.description ?? '',
        priority: activity?.priority ?? 'medium',
        dueDate: dateInput(activity?.dueDate) || today,
        status: activity?.status === 'completed' || preset?.status === 'completed' ? 'completed' : 'pending',
        outcome: activity?.outcome ?? preset?.outcome ?? '',
        contactId: activity?.contactId ?? preset?.contactId ?? '',
        dealId: activity?.dealId ?? preset?.dealId ?? '',
      }}
      onSubmit={(v) => {
        const next: Activity = {
          id: activity?.id ?? uid('act'),
          type: v.type as ActivityType,
          subject: v.subject,
          description: v.description,
          status: v.status as ActivityStatus,
          priority: v.priority as Priority,
          dueDate: v.dueDate,
          dealId: v.dealId,
          contactId: v.contactId,
          outcome: v.outcome,
          createdAt: activity?.createdAt ?? new Date().toISOString(),
        };
        upsert('activities', next);
        const contact = contacts.find((c) => c.id === v.contactId);
        if (contact && next.status === 'completed') {
          upsert('contacts', { ...contact, lastContactedAt: new Date().toISOString() });
        }
        onClose();
      }}
      onDelete={
        activity
          ? () => {
              remove('activities', activity.id);
              onClose();
            }
          : undefined
      }
    />
  );
}
