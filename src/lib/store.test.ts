import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/lib/store';
import type { Tier } from '@/types/sales-os';

const acc = (id: string, name: string, tier: Tier = 'SMB') => ({
  id, name, domain: '', industry: '', size: 0, annualRevenue: 0, tier, createdAt: '',
});

describe('store upsertMany', () => {
  beforeEach(() => {
    useStore.setState({
      accounts: [],
      contacts: [],
      deals: [],
      activities: [],
      products: [],
      quotes: [],
      playbooks: [],
      settings: {
        currency: 'USD',
        locale: 'en-US',
        theme: 'dark',
        stages: [
          { id: 'lead_in', label: 'Lead In', probability: 10 },
        ],
      },
      seeded: false,
      dbVersion: 0,
    });
  });

  it('replaces existing items by id instead of duplicating', () => {
    useStore.setState({ accounts: [acc('acc_1', 'Old Name')] });

    useStore.getState().upsertMany('accounts', [acc('acc_1', 'New Name')]);

    const accounts = useStore.getState().accounts;
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe('New Name');
  });

  it('appends new items and keeps existing ones', () => {
    useStore.setState({ accounts: [acc('acc_1', 'One')] });

    useStore.getState().upsertMany('accounts', [acc('acc_2', 'Two')]);

    const accounts = useStore.getState().accounts;
    expect(accounts).toHaveLength(2);
    expect(accounts.map((a) => a.name).sort()).toEqual(['One', 'Two']);
  });
});
