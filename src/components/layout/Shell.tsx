'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  Briefcase,
  Building2,
  CheckSquare,
  FileText,
  Kanban,
  LayoutDashboard,
  Mail,
  Menu,
  Plus,
  Search,
  Settings as SettingsIcon,
  Users,
  X,
  Cloud,
  AlertCircle,
} from 'lucide-react';
import { useStore, useUi } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { CommandMenu } from '@/components/layout/CommandMenu';
import { ContactFormModal, DealFormModal, ActivityFormModal } from '@/components/forms';

export const NAV = [
  { href: '/', label: 'Command Center', icon: LayoutDashboard },
  { href: '/pipeline', label: 'Pipeline', icon: Kanban },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/accounts', label: 'Accounts', icon: Building2 },
  { href: '/campaigns', label: 'Campaigns', icon: Mail },
  { href: '/activities', label: 'Activities', icon: CheckSquare },
  { href: '/quotes', label: 'Quotes & Catalog', icon: FileText },
  { href: '/playbooks', label: 'Playbooks', icon: BookOpen },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function Shell({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const pathname = usePathname();
  const theme = useStore((s) => s.settings.theme);
  const syncing = useStore((s) => s.syncing);
  const syncError = useStore((s) => s.syncError);
  const { quickAdd, setQuickAdd, setPalette } = useUi();

  useEffect(() => {
    Promise.resolve(useStore.persist.rehydrate()).then(() => {
      if (!useStore.getState().seeded) useStore.getState().seedDemo();
      setReady(true);
    });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [setPalette]);

  const syncIcon = syncing ? <Cloud className="w-4 h-4 animate-spin" /> : syncError ? <AlertCircle className="w-4 h-4 text-red-500" /> : <Cloud className="w-4 h-4 text-muted" />;

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {mobileMenu && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setMobileMenu(false)} />
      )}
      <aside className={`sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-line bg-panel p-3 md:flex ${mobileMenu ? 'flex' : 'hidden'} md:!flex`}>
        <div className="mb-5 flex items-center gap-2 px-2 pt-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-white">
            <Briefcase size={16} />
          </div>
          <span className="text-base font-semibold">Sales OS</span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map((n) => {
            const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMobileMenu(false)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm',
                  active ? 'bg-raised font-medium text-fg' : 'text-muted hover:bg-raised hover:text-fg',
                )}
              >
                <n.icon size={16} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto pt-4 border-t border-line">
          <div className="flex items-center gap-2 px-2 text-xs text-muted">
            {syncIcon}
            <span>{syncing ? 'Syncing…' : syncError ? 'Sync error' : 'Synced'}</span>
          </div>
          <p className="px-2 text-xs text-muted">Press Ctrl/Cmd+K</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-bg/90 px-4 py-2.5 backdrop-blur">
          <button
            onClick={() => setMobileMenu((m) => !m)}
            className="p-1.5 rounded-md text-muted hover:text-fg hover:bg-raised md:hidden"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <nav className="flex gap-1 overflow-x-auto md:hidden">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setMobileMenu(false)} className="whitespace-nowrap rounded px-2 py-1 text-xs text-muted hover:bg-raised">
                {n.label}
              </Link>
            ))}
          </nav>
          <button
            onClick={() => setPalette(true)}
            className="ml-auto flex w-48 items-center gap-2 rounded-md border border-line bg-panel px-3 py-1.5 text-sm text-muted sm:w-72"
          >
            <Search size={14} /> Search or jump to...
          </button>
          <Button onClick={() => setQuickAdd('deal')}>
            <Plus size={14} /> Quick add
          </Button>
        </header>
        <main className="flex-1 p-4 md:p-6">
          {ready ? children : <p className="text-sm text-muted">Loading workspace...</p>}
        </main>
      </div>
      <CommandMenu />
      {quickAdd === 'deal' && <QuickAddChooser />}
      {quickAdd === 'contact' && <ContactFormModal onClose={() => setQuickAdd(null)} />}
      {quickAdd === 'task' && <ActivityFormModal onClose={() => setQuickAdd(null)} />}
    </div>
  );
}

function QuickAddChooser() {
  const { setQuickAdd } = useUi();
  const [mode, setMode] = useState<'choose' | 'deal'>('choose');
  if (mode === 'deal') return <DealFormModal onClose={() => setQuickAdd(null)} />;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={() => setQuickAdd(null)}>
      <div
        className="w-full max-w-xs rounded-lg border border-line bg-panel p-4"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-sm font-semibold">Create new</h2>
        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={() => setMode('deal')}>
            Deal
          </Button>
          <Button variant="outline" onClick={() => setQuickAdd('contact')}>
            Contact
          </Button>
          <Button variant="outline" onClick={() => setQuickAdd('task')}>
            Task
          </Button>
        </div>
      </div>
    </div>
  );
}
