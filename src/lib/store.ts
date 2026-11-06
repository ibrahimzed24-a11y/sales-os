'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Entities, EntityKey, Settings, StageConfig } from '@/types/sales-os';
import { buildSeed } from '@/lib/seed';
import { dbCall, ApiError } from '@/lib/api';
import { toast } from 'sonner';
import { uid } from '@/lib/utils';

export const DEFAULT_STAGES: StageConfig[] = [
  { id: 'lead_in', label: 'Lead In', probability: 10 },
  { id: 'discovery', label: 'Discovery', probability: 25 },
  { id: 'demo', label: 'Demo / Qualification', probability: 40 },
  { id: 'proposal', label: 'Proposal Sent', probability: 60 },
  { id: 'negotiation', label: 'Negotiation', probability: 80 },
  { id: 'closed_won', label: 'Closed Won', probability: 100 },
  { id: 'closed_lost', label: 'Closed Lost', probability: 0 },
];

const EMPTY: Entities = {
  accounts: [],
  contacts: [],
  deals: [],
  activities: [],
  products: [],
  quotes: [],
  playbooks: [],
};

const DEFAULT_SETTINGS: Settings = {
  currency: 'USD',
  locale: 'en-US',
  theme: 'dark',
  stages: DEFAULT_STAGES,
};

interface State extends Entities {
  settings: Settings;
  seeded: boolean;
  dbVersion: number;
  syncing: boolean;
  syncError: string | null;
  upsert: <K extends EntityKey>(key: K, item: Entities[K][number]) => void;
  upsertMany: <K extends EntityKey>(key: K, items: Entities[K]) => void;
  remove: (key: EntityKey, id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  seedDemo: () => void;
  clearAll: () => void;
  importAll: (data: Entities) => void;
  // Cloud sync
  syncToCloud: () => Promise<void>;
  syncFromCloud: () => Promise<void>;
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      settings: DEFAULT_SETTINGS,
      seeded: false,
      dbVersion: 0,
      syncing: false,
      syncError: null,
      upsert: (key, item) =>
        set((s) => {
          const list = s[key] as unknown as { id: string }[];
          const entry = item as unknown as { id: string };
          const next = list.some((x) => x.id === entry.id)
            ? list.map((x) => (x.id === entry.id ? entry : x))
            : [...list, entry];
          return { [key]: next } as unknown as Partial<State>;
        }),
      upsertMany: (key, items) =>
        set((s) => {
          const list = s[key] as unknown as { id: string }[];
          const incoming = items as unknown as { id: string }[];
          const next = [...list, ...incoming];
          return { [key]: next } as unknown as Partial<State>;
        }),
      remove: (key, id) =>
        set((s) => {
          const list = s[key] as unknown as { id: string }[];
          return { [key]: list.filter((x) => x.id !== id) } as unknown as Partial<State>;
        }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      seedDemo: () => set(() => ({ ...buildSeed(), seeded: true })),
      clearAll: () => set(() => ({ ...EMPTY, seeded: true })),
      importAll: (data) => set(() => ({ ...data, seeded: true })),

      // --- Cloud sync ---
      syncToCloud: async () => {
        const s = get();
        set({ syncing: true, syncError: null });
        try {
          const snapshot = {
            settings: s.settings,
            deals: s.deals,
            activities: s.activities,
            products: s.products,
            quotes: s.quotes,
            playbooks: s.playbooks,
          };
          await dbCall('PUT', '/api/state', JSON.stringify(snapshot), { silent: true });
          // Don't throw on sync failure - local store is the source of truth
        } catch (e) {
          set({ syncError: e instanceof Error ? e.message : 'Sync failed' });
          // Silent - local data is still available
        } finally {
          set({ syncing: false });
        }
      },

      syncFromCloud: async () => {
        set({ syncing: true, syncError: null });
        try {
          const res = await dbCall<{ configured?: boolean; data?: Record<string, unknown> | null }>('GET', '/api/state', undefined, { silent: true });
          if (!res.configured) return;
          if (res.data && Array.isArray(res.data.deals)) {
            const rest = { ...res.data };
            delete rest.contacts;
            delete rest.accounts;
            set((s) => ({
              ...rest,
              accounts: s.accounts, // keep local accounts/contacts unless explicitly synced
              contacts: s.contacts,
            } as unknown as Partial<State>));
          }
        } catch (e) {
          set({ syncError: e instanceof Error ? e.message : 'Sync failed' });
        } finally {
          set({ syncing: false });
        }
      },
    }),
    { name: 'sales-os-store', version: 2, skipHydration: true },
  ),
);

export type PaletteFocus = { kind: 'contact' | 'account' | 'deal'; id: string } | null;

interface UiState {
  palette: boolean;
  quickAdd: 'deal' | 'contact' | 'task' | null;
  focus: PaletteFocus;
  setPalette: (v: boolean) => void;
  setQuickAdd: (v: UiState['quickAdd']) => void;
  setFocus: (v: PaletteFocus) => void;
}

export const useUi = create<UiState>()((set) => ({
  palette: false,
  quickAdd: null,
  focus: null,
  setPalette: (v: boolean) => set({ palette: v }),
  setQuickAdd: (v: UiState['quickAdd']) => set({ quickAdd: v }),
  setFocus: (v: PaletteFocus) => set({ focus: v }),
}));

// --- Contacts and accounts live in their own relational tables; the store keeps a cache for dropdowns and the command palette. ---
export async function refreshDirectory(): Promise<void> {
  try {
    const load = async (t: string) => {
      const out: unknown[] = [];
      for (let p = 1; p <= 10; p++) {
        const r = await dbCall<{ rows: unknown[]; total: number }>('GET', '/api/db/' + t + '?all=1&sort=created_at&dir=asc&page=' + p, undefined, { silent: true });
        out.push(...r.rows);
        if (r.rows.length < 1000) break;
      }
      return out;
    };
    const [accounts, contacts] = await Promise.all([load('accounts'), load('contacts')]);
    useStore.setState({ accounts, contacts } as unknown as Partial<Entities>);
  } catch {
    /* keep the cached copy */
  }
}

if (typeof window !== 'undefined') {
  const base = useStore.getState();
  const bump = () => useStore.setState((s) => ({ dbVersion: s.dbVersion + 1 }));
  const mirror = async (key: string, items: unknown[]) => {
    if (key === 'contacts' || key === 'accounts') {
      try {
        await dbCall('POST', '/api/db/' + key, { items }, { silent: true });
        bump();
      } catch {
        // Silent - local store is source of truth
      }
    }
  };
  useStore.setState({
    upsert: ((key: EntityKey, item: unknown) => {
      base.upsert(key, item as never);
      void mirror(key, [item]).catch(() => undefined);
    }) as State['upsert'],
    upsertMany: ((key: EntityKey, items: unknown[]) => {
      base.upsertMany(key, items as never);
      void mirror(key, items).catch(() => undefined);
    }) as State['upsertMany'],
    remove: ((key: EntityKey, id: string) => {
      base.remove(key, id);
      if (key === 'contacts' || key === 'accounts') {
        void dbCall('DELETE', '/api/db/' + key + '?id=' + encodeURIComponent(id), undefined, { silent: true }).then(bump).catch(() => undefined);
      }
    }) as State['remove'],
  });

  // Periodic cloud sync (every 30 seconds when cloud is configured)
  let syncTimer: ReturnType<typeof setInterval> | undefined;
  function startSyncTimer() {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = setInterval(() => {
      void useStore.getState().syncToCloud();
    }, 30000);
  }
  // Start sync timer after hydration
  setTimeout(() => {
    void useStore.getState().syncFromCloud();
    startSyncTimer();
  }, 1000);

  // Sync on visibility change (when user returns to tab)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      void useStore.getState().syncFromCloud();
    }
  });
}
