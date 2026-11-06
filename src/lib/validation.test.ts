import { describe, it, expect } from 'vitest';
import {
  validateAccount,
  validateContact,
  validateDeal,
  validateActivity,
  validateProduct,
  validateQuote,
  validatePlaybookItem,
  validateSettings,
} from '@/lib/validation';

describe('validation schemas', () => {
  describe('Account', () => {
    it('accepts valid account', () => {
      const result = validateAccount({
        name: 'Acme Corp',
        domain: 'acme.com',
        industry: 'Tech',
        size: 100,
        annualRevenue: 5000000,
        tier: 'Enterprise',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing name', () => {
      const result = validateAccount({ domain: 'acme.com' });
      expect(result.success).toBe(false);
    });
  });

  describe('Contact', () => {
    it('accepts valid contact', () => {
      const result = validateContact({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '+1234567890',
        owner: 'Sara Ali',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing first name', () => {
      const result = validateContact({ lastName: 'Doe', owner: 'Sara Ali' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid email', () => {
      const result = validateContact({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'not-an-email',
        owner: 'Sara Ali',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Deal', () => {
    it('accepts valid deal', () => {
      const result = validateDeal({
        title: 'Enterprise Deal',
        accountId: 'acc_1',
        value: 50000,
        currency: 'USD',
        owner: 'Sara Ali',
        expectedCloseDate: new Date().toISOString(),
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing accountId', () => {
      const result = validateDeal({ title: 'Deal', value: 100, owner: 'Sara Ali', expectedCloseDate: new Date().toISOString() });
      expect(result.success).toBe(false);
    });
  });

  describe('Activity', () => {
    it('accepts valid activity', () => {
      const result = validateActivity({
        type: 'call',
        subject: 'Follow up call',
        dueDate: new Date().toISOString(),
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing subject', () => {
      const result = validateActivity({ type: 'call', dueDate: new Date().toISOString() });
      expect(result.success).toBe(false);
    });
  });

  describe('Product', () => {
    it('accepts valid product', () => {
      const result = validateProduct({
        sku: 'PROD-001',
        name: 'Core Platform',
        kind: 'recurring',
        billingCycle: 'monthly',
        basePrice: 45,
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing SKU', () => {
      const result = validateProduct({ name: 'Test', basePrice: 10 });
      expect(result.success).toBe(false);
    });
  });

  describe('Quote', () => {
    it('accepts valid quote', () => {
      const result = validateQuote({
        dealId: 'deal_1',
        items: [
          { productId: 'prod_1', name: 'Item', quantity: 2, unitPrice: 100, discount: 0 },
        ],
        taxRate: 8,
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty items', () => {
      const result = validateQuote({ dealId: 'deal_1', items: [] });
      expect(result.success).toBe(false);
    });
  });

  describe('PlaybookItem', () => {
    it('accepts valid playbook item', () => {
      const result = validatePlaybookItem({
        category: 'Script',
        title: 'Cold call opener',
        content: 'Hi {{first_name}}',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing content', () => {
      const result = validatePlaybookItem({ category: 'Script', title: 'Test', content: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('Settings', () => {
    it('accepts valid settings', () => {
      const result = validateSettings({
        currency: 'USD',
        locale: 'en-US',
        theme: 'dark',
        stages: [{ id: 'lead_in', label: 'Lead In', probability: 10 }],
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty stages', () => {
      const result = validateSettings({
        currency: 'USD',
        locale: 'en-US',
        theme: 'dark',
        stages: [],
      });
      expect(result.success).toBe(false);
    });
  });
});
