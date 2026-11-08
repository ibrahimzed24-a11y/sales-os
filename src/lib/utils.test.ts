import { describe, it, expect } from 'vitest';
import { uid, money, fmtDate, daysSince, initials, toCSV, parseCSV, num } from '@/lib/utils';

describe('utils', () => {
  describe('uid', () => {
    it('generates unique IDs with prefix', () => {
      const a = uid('note');
      const b = uid('note');
      expect(a.startsWith('note_')).toBe(true);
      expect(b.startsWith('note_')).toBe(true);
      expect(a).not.toBe(b);
    });

    it('returns bare UUIDs for database-backed prefixes', () => {
      expect(uid('deal')).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('generates IDs of consistent length', () => {
      const id = uid('test');
      const parts = id.split('_');
      expect(parts[1].length).toBe(14);
    });
  });

  describe('money', () => {
    it('formats USD correctly', () => {
      expect(money(1234.56)).toBe('$1,235');
    });

    it('handles zero', () => {
      expect(money(0)).toBe('$0');
    });
  });

  describe('fmtDate', () => {
    it('formats ISO date', () => {
      expect(fmtDate('2024-01-15T10:00:00Z')).toBe('Jan 15, 2024');
    });

    it('returns dash for null', () => {
      expect(fmtDate(null)).toBe('—');
      expect(fmtDate(undefined)).toBe('—');
    });
  });

  describe('daysSince', () => {
    it('calculates days since date', () => {
      const past = new Date(Date.now() - 5 * 86400000).toISOString();
      expect(daysSince(past)).toBe(5);
    });
  });

  describe('initials', () => {
    it('extracts initials from name', () => {
      expect(initials('John Doe')).toBe('JD');
      expect(initials('Jane')).toBe('J');
      expect(initials('')).toBe('');
    });
  });

  describe('num', () => {
    it('converts valid numbers', () => {
      expect(num('42')).toBe(42);
      expect(num('abc')).toBe(0);
      expect(num(undefined)).toBe(0);
    });
  });

  describe('toCSV / parseCSV', () => {
    it('round-trips simple data', () => {
      const rows = [{ name: 'Acme', value: '100' }, { name: 'Beta', value: '200' }];
      const csv = toCSV(rows);
      const parsed = parseCSV(csv);
      expect(parsed[0]).toEqual(['name', 'value']);
      expect(parsed[1]).toEqual(['Acme', '100']);
    });

    it('handles quoted fields with commas', () => {
      const rows = [{ name: 'Acme, Inc', value: '100' }];
      const csv = toCSV(rows);
      const parsed = parseCSV(csv);
      expect(parsed[1][0]).toBe('Acme, Inc');
    });

    it('parses semicolon-delimited data', () => {
      const parsed = parseCSV('name;city\nAcme;NYC\nBeta;LA', ';');
      expect(parsed[0]).toEqual(['name', 'city']);
      expect(parsed[1]).toEqual(['Acme', 'NYC']);
      expect(parsed[2]).toEqual(['Beta', 'LA']);
    });

    it('parses tab-delimited data', () => {
      const parsed = parseCSV('name\tcity\nAcme\tNYC', '\t');
      expect(parsed[1]).toEqual(['Acme', 'NYC']);
    });
  });
});
