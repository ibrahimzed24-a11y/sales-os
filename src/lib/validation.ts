import { z } from 'zod';

// --- Shared primitives ---
export const uuid = z.string().min(1, 'ID is required');
export const email = z.string().email('Invalid email address').optional().or(z.literal(''));
export const phone = z.string().optional().or(z.literal(''));
export const positiveInt = z.coerce.number().int().nonnegative('Must be a non-negative number');
export const score = z.coerce.number().int().min(0, 'Min 0').max(100, 'Max 100');
export const probability = z.coerce.number().int().min(0, 'Min 0').max(100, 'Max 100');
export const money = z.coerce.number().nonnegative('Must be non-negative');
export const tags = z
  .string()
  .optional()
  .or(z.literal(''))
  .transform((v) => (v ? v.split(',').map((t) => t.trim()).filter(Boolean) : []));
export const isoDate = z.string().datetime({ offset: true }).optional().or(z.literal(''));

// --- Enums (match prisma/schema.prisma) ---
export const TierSchema = z.enum(['Enterprise', 'Mid-Market', 'SMB']);
export const LeadStatusSchema = z.enum(['New', 'Contacted', 'Working', 'Qualified', 'Unqualified']);
export const LeadSourceSchema = z.enum(['Inbound', 'Outbound', 'Referral', 'Partner']);
export const DealStageSchema = z.enum([
  'lead_in',
  'discovery',
  'demo',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
]);
export const ActivityTypeSchema = z.enum(['call', 'email', 'meeting', 'task', 'note']);
export const ActivityStatusSchema = z.enum(['pending', 'completed', 'overdue']);
export const PrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export const QuoteStatusSchema = z.enum(['Draft', 'Sent', 'Accepted', 'Declined']);
export const PlaybookCategorySchema = z.enum(['Script', 'Objection', 'Template', 'Framework']);
export const ProductKindSchema = z.enum(['recurring', 'one-time']);
export const BillingCycleSchema = z.enum(['monthly', 'annual', 'one-time']);

// --- Entity schemas ---
export const AccountSchema = z.object({
  id: uuid.optional(),
  name: z.string().min(1, 'Company name is required'),
  domain: z.string().optional().or(z.literal('')),
  industry: z.string().optional().or(z.literal('')),
  size: positiveInt.optional().default(0),
  annualRevenue: money.optional().default(0),
  tier: TierSchema.default('SMB'),
  createdAt: isoDate,
});

export const ContactSchema = z.object({
  id: uuid.optional(),
  accountId: z.string().optional().or(z.literal('')),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: email,
  phone: phone,
  role: z.string().optional().or(z.literal('')),
  leadStatus: LeadStatusSchema.default('New'),
  leadScore: score.default(50),
  source: LeadSourceSchema.default('Inbound'),
  tags: tags.default([]),
  owner: z.string().min(1, 'Owner is required'),
  lastContactedAt: isoDate,
  createdAt: isoDate,
});

export const DealSchema = z.object({
  id: uuid.optional(),
  title: z.string().min(1, 'Deal title is required'),
  accountId: uuid,
  primaryContactId: uuid.optional().or(z.literal('')),
  stage: DealStageSchema.default('lead_in'),
  value: money,
  currency: z.string().min(1, 'Currency is required').default('USD'),
  probability: probability.default(0),
  expectedCloseDate: isoDate,
  lossReason: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  owner: z.string().min(1, 'Owner is required'),
  updatedAt: isoDate,
  createdAt: isoDate,
});

export const ActivitySchema = z.object({
  id: uuid.optional(),
  type: ActivityTypeSchema.default('task'),
  subject: z.string().min(1, 'Subject is required'),
  description: z.string().optional().or(z.literal('')),
  status: ActivityStatusSchema.default('pending'),
  priority: PrioritySchema.default('medium'),
  dueDate: z.string().min(1, 'Due date is required'),
  dealId: z.string().optional().or(z.literal('')),
  contactId: z.string().optional().or(z.literal('')),
  outcome: z.string().optional().or(z.literal('')),
  createdAt: isoDate,
});

export const ProductSchema = z.object({
  id: uuid.optional(),
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Product name is required'),
  kind: ProductKindSchema.default('one-time'),
  billingCycle: BillingCycleSchema.default('one-time'),
  basePrice: money,
});

export const QuoteItemSchema = z.object({
  productId: uuid,
  name: z.string().min(1, 'Item name is required'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: money,
  discount: z.coerce.number().min(0, 'Min 0').max(100, 'Max 100').default(0),
});

export const QuoteSchema = z.object({
  id: uuid.optional(),
  dealId: uuid,
  status: QuoteStatusSchema.default('Draft'),
  items: z.array(QuoteItemSchema).min(1, 'At least one line item is required'),
  taxRate: z.coerce.number().min(0, 'Min 0').max(100, 'Max 100').default(0),
  totalAmount: money.default(0),
  validUntil: isoDate,
  createdAt: isoDate,
});

export const PlaybookItemSchema = z.object({
  id: uuid.optional(),
  category: PlaybookCategorySchema.default('Script'),
  title: z.string().min(1, 'Title is required'),
  tags: tags.default([]),
  content: z.string().min(1, 'Content is required'),
  updatedAt: isoDate,
});

// --- Settings ---
export const StageConfigSchema = z.object({
  id: DealStageSchema,
  label: z.string().min(1, 'Label is required'),
  probability: probability.default(0),
});

export const SettingsSchema = z.object({
  currency: z.string().min(1, 'Currency is required').default('USD'),
  locale: z.string().min(1, 'Locale is required').default('en-US'),
  theme: z.enum(['dark', 'light']).default('dark'),
  stages: z.array(StageConfigSchema).min(1, 'At least one stage is required'),
});

// --- Import schemas ---
export const ImportRowSchema = z.record(z.string(), z.string());

// --- Type exports ---
export type AccountInput = z.infer<typeof AccountSchema>;
export type ContactInput = z.infer<typeof ContactSchema>;
export type DealInput = z.infer<typeof DealSchema>;
export type ActivityInput = z.infer<typeof ActivitySchema>;
export type ProductInput = z.infer<typeof ProductSchema>;
export type QuoteInput = z.infer<typeof QuoteSchema>;
export type PlaybookItemInput = z.infer<typeof PlaybookItemSchema>;
export type SettingsInput = z.infer<typeof SettingsSchema>;
export type StageConfigInput = z.infer<typeof StageConfigSchema>;

// --- Validation helpers ---
export function validateAccount(data: unknown) {
  return AccountSchema.safeParse(data);
}
export function validateContact(data: unknown) {
  return ContactSchema.safeParse(data);
}
export function validateDeal(data: unknown) {
  return DealSchema.safeParse(data);
}
export function validateActivity(data: unknown) {
  return ActivitySchema.safeParse(data);
}
export function validateProduct(data: unknown) {
  return ProductSchema.safeParse(data);
}
export function validateQuote(data: unknown) {
  return QuoteSchema.safeParse(data);
}
export function validatePlaybookItem(data: unknown) {
  return PlaybookItemSchema.safeParse(data);
}
export function validateSettings(data: unknown) {
  return SettingsSchema.safeParse(data);
}
