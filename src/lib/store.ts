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


// --- Cloud sync (Supabase via /api/state). Falls back to browser-only storage when the API is not configured. ---
const SYNC_KEYS = ['accounts', 'contacts', 'deals', 'activities', 'products', 'quotes', 'playbooks'] as const;

function snapshot() {
  const s = useStore.getState();
  const out: Record<string, unknown> = { settings: s.settings, seeded: s.seeded };
  for (const k of SYNC_KEYS) out[k] = s[k];
  return out;
}

function accessCode(ask: boolean) {
  let c = localStorage.getItem('sales-os-access') ?? '';
  if (!c && ask) {
    c = window.prompt('Sales OS access code') ?? '';
    if (c) localStorage.setItem('sales-os-access', c);
  }
  return c;
}

async function api(method: 'GET' | 'PUT', body?: string): Promise<Response> {
  const call = () =>
    fetch('/api/state', { method, cache: 'no-store', headers: { 'Content-Type': 'application/json', 'x-access-code': accessCode(true) }, body });
  let r = await call();
  if (r.status === 401) {
    localStorage.removeItem('sales-os-access');
    r = await call();
    if (r.status === 401) localStorage.removeItem('sales-os-access');
  }
  return r;
}

if (typeof window !== 'undefined') {
  let ready = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const push = () => {
    if (!ready) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      void api('PUT', JSON.stringify(snapshot())).catch(() => undefined);
    }, 700);
  };
  void api('GET')
    .then((r) => r.json())
    .then((res: { configured?: boolean; data?: Record<string, unknown> | null }) => {
      if (!res.configured) return;
      if (res.data && Array.isArray(res.data.contacts)) useStore.setState(res.data as unknown as Partial<State>);
      if (!('error' in res)) {
        ready = true;
        if (!res.data) push();
      }
    })
    .catch(() => undefined);
  useStore.subscribe(push);
}
