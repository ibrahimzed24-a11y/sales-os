'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Entities, EntityKey, Settings, StageConfig } from '@/types/sales-os';
import { buildSeed } from '@/lib/seed';

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
  upsert: <K extends EntityKey>(key: K, item: Entities[K][number]) => void;
  upsertMany: <K extends EntityKey>(key: K, items: Entities[K]) => void;
  remove: (key: EntityKey, id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  seedDemo: () => void;
  clearAll: () => void;
  importAll: (data: Entities) => void;
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      ...EMPTY,
      settings: DEFAULT_SETTINGS,
      seeded: false,
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
          return { [key]: [...list, ...(items as unknown as { id: string }[])] } as unknown as Partial<State>;
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
    }),
    { name: 'sales-os-store', version: 1, skipHydration: true },
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
  setPalette: (v) => set({ palette: v }),
  setQuickAdd: (v) => set({ quickAdd: v }),
  setFocus: (v) => set({ focus: v }),
}));
