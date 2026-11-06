export type Tier = 'Enterprise' | 'Mid-Market' | 'SMB';
export type LeadStatus = 'New' | 'Contacted' | 'Working' | 'Qualified' | 'Unqualified';
export type LeadSource = 'Inbound' | 'Outbound' | 'Referral' | 'Partner';
export type StageId =
  | 'lead_in'
  | 'discovery'
  | 'demo'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';
export type ActivityType = 'call' | 'email' | 'meeting' | 'task' | 'note';
export type ActivityStatus = 'pending' | 'completed' | 'overdue';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Declined';
export type PlaybookCategory = 'Script' | 'Objection' | 'Template' | 'Framework';

export interface Account {
  id: string;
  name: string;
  domain: string;
  industry: string;
  size: number;
  annualRevenue: number;
  tier: Tier;
  createdAt: string;
}

export interface Contact {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  leadStatus: LeadStatus;
  leadScore: number;
  source: LeadSource;
  tags: string[];
  owner: string;
  lastContactedAt: string | null;
  createdAt: string;
}

export interface Deal {
  id: string;
  title: string;
  accountId: string;
  primaryContactId: string;
  stage: StageId;
  value: number;
  currency: string;
  probability: number;
  expectedCloseDate: string;
  lossReason?: string;
  notes: string;
  owner: string;
  updatedAt: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  subject: string;
  description: string;
  status: ActivityStatus;
  priority: Priority;
  dueDate: string;
  dealId: string;
  contactId: string;
  outcome: string;
  createdAt: string;
}

export type ProductKind = 'recurring' | 'one-time';
export type BillingCycle = 'monthly' | 'annual' | 'one-time';

export interface Product {
  id: string;
  sku: string;
  name: string;
  kind: ProductKind;
  billingCycle: BillingCycle;
  basePrice: number;
}

export interface QuoteItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export interface Quote {
  id: string;
  dealId: string;
  status: QuoteStatus;
  items: QuoteItem[];
  taxRate: number;
  totalAmount: number;
  validUntil: string;
  createdAt: string;
}

export interface PlaybookItem {
  id: string;
  category: PlaybookCategory;
  title: string;
  tags: string[];
  content: string;
  updatedAt: string;
}

export interface StageConfig {
  id: StageId;
  label: string;
  probability: number;
}

export interface Entities {
  accounts: Account[];
  contacts: Contact[];
  deals: Deal[];
  activities: Activity[];
  products: Product[];
  quotes: Quote[];
  playbooks: PlaybookItem[];
}

export type EntityKey = keyof Entities;

export interface Settings {
  currency: string;
  locale: string;
  theme: 'dark' | 'light';
  stages: StageConfig[];
}
