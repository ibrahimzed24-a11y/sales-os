import { describe, it, expect } from 'vitest';
import { computeKpis, forecastByMonth, funnel, velocity, isOpen, isStale } from '@/lib/metrics';
import type { Deal, Contact, StageConfig } from '@/types/sales-os';

const stages: StageConfig[] = [
  { id: 'lead_in', label: 'Lead In', probability: 10 },
  { id: 'discovery', label: 'Discovery', probability: 25 },
  { id: 'demo', label: 'Demo', probability: 40 },
  { id: 'proposal', label: 'Proposal', probability: 60 },
  { id: 'negotiation', label: 'Negotiation', probability: 80 },
  { id: 'closed_won', label: 'Closed Won', probability: 100 },
  { id: 'closed_lost', label: 'Closed Lost', probability: 0 },
];

const baseDeal = (overrides: Partial<Deal> = {}): Deal => ({
  id: 'deal_1',
  title: 'Test Deal',
  accountId: 'acc_1',
  primaryContactId: 'con_1',
  stage: 'lead_in',
  value: 10000,
  currency: 'USD',
  probability: 10,
  expectedCloseDate: new Date(Date.now() + 30 * 86400000).toISOString(),
  notes: '',
  owner: 'Sara Ali',
  updatedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  ...overrides,
});

const baseContact = (overrides: Partial<Contact> = {}): Contact => ({
  id: 'con_1',
  accountId: 'acc_1',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  phone: '+1234567890',
  role: 'VP',
  leadStatus: 'Qualified',
  leadScore: 80,
  source: 'Inbound',
  tags: [],
  owner: 'Sara Ali',
  lastContactedAt: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe('metrics', () => {
  describe('isOpen', () => {
    it('returns true for open stages', () => {
      expect(isOpen(baseDeal({ stage: 'lead_in' }))).toBe(true);
      expect(isOpen(baseDeal({ stage: 'negotiation' }))).toBe(true);
    });
    it('returns false for closed stages', () => {
      expect(isOpen(baseDeal({ stage: 'closed_won' }))).toBe(false);
      expect(isOpen(baseDeal({ stage: 'closed_lost' }))).toBe(false);
    });
  });

  describe('computeKpis', () => {
    it('computes pipeline value correctly', () => {
      const deals = [
        baseDeal({ stage: 'lead_in', value: 10000 }),
        baseDeal({ id: 'deal_2', stage: 'demo', value: 20000 }),
        baseDeal({ id: 'deal_3', stage: 'closed_won', value: 50000 }),
      ];
      const contacts = [baseContact()];
      const kpis = computeKpis(deals, contacts);
      expect(kpis.pipelineValue).toBe(30000);
      expect(kpis.wonMtd).toBe(50000);
    });

    it('computes win rate correctly', () => {
      const deals = [
        baseDeal({ stage: 'closed_won' }),
        baseDeal({ id: 'deal_2', stage: 'closed_lost' }),
        baseDeal({ id: 'deal_3', stage: 'lead_in' }),
      ];
      const kpis = computeKpis(deals, []);
      expect(kpis.winRate).toBe(50);
    });
  });

  describe('forecastByMonth', () => {
    it('returns empty array for no deals', () => {
      const result = forecastByMonth([], 3);
      expect(result.length).toBe(3);
      result.forEach((m) => expect(m.total).toBe(0));
    });

    it('distributes deals by expected close date', () => {
      const nextMonth = new Date(Date.now() + 45 * 86400000).toISOString();
      const deals = [baseDeal({ expectedCloseDate: nextMonth, value: 10000 })];
      const result = forecastByMonth(deals, 2);
      expect(result[1].total).toBe(10000);
    });
  });

  describe('funnel', () => {
    it('groups deals by stage', () => {
      const deals = [
        baseDeal({ stage: 'lead_in', value: 10000 }),
        baseDeal({ id: 'deal_2', stage: 'lead_in', value: 5000 }),
        baseDeal({ id: 'deal_3', stage: 'demo', value: 20000 }),
      ];
      const result = funnel(deals, stages);
      const leadIn = result.find((f) => f.stage === 'Lead In');
      expect(leadIn?.count).toBe(2);
      expect(leadIn?.value).toBe(15000);
    });
  });

  describe('velocity', () => {
    it('returns 0 days for empty stage', () => {
      const deals: Deal[] = [];
      const result = velocity(deals, stages);
      expect(result.length).toBe(stages.length - 2); // excludes closed_won and closed_lost
    });
  });
});
