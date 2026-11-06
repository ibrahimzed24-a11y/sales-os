'use client';

import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'ghost' | 'danger' | 'outline';

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles: Record<Variant, string> = {
    primary: 'bg-brand text-white hover:opacity-90',
    ghost: 'text-muted hover:bg-raised hover:text-fg',
    danger: 'bg-red-600 text-white hover:bg-red-500',
    outline: 'border border-line text-fg hover:bg-raised',
  };
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-50',
        styles[variant],
        className,
      )}
    />
  );
}

type Tone = 'slate' | 'green' | 'red' | 'amber' | 'blue' | 'violet';

export function Badge({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) {
  const tones: Record<Tone, string> = {
    slate: 'bg-raised text-muted',
    green: 'bg-emerald-500/15 text-emerald-500',
    red: 'bg-red-500/15 text-red-500',
    amber: 'bg-amber-500/15 text-amber-500',
    blue: 'bg-sky-500/15 text-sky-500',
    violet: 'bg-violet-500/15 text-violet-400',
  };
  return <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-lg border border-line bg-panel', className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

export const inputCls =
  'w-full rounded-md border border-line bg-bg px-3 py-1.5 text-sm text-fg outline-none focus:border-brand';

function useEsc(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEsc(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className={cn('max-h-[90vh] w-full overflow-y-auto rounded-lg border border-line bg-panel p-5', wide ? 'max-w-3xl' : 'max-w-lg')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="text-muted hover:text-fg">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEsc(onClose);
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onMouseDown={onClose}>
      <aside
        role="dialog"
        aria-label={title}
        className="h-full w-full max-w-xl overflow-y-auto border-l border-line bg-panel p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="text-muted hover:text-fg">
            <X size={18} />
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

export interface FieldSpec {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'email';
  options?: { value: string; label: string }[];
  required?: boolean;
}

export function FormModal({
  title,
  fields,
  initial,
  onSubmit,
  onClose,
  onDelete,
}: {
  title: string;
  fields: FieldSpec[];
  initial: Record<string, string>;
  onSubmit: (values: Record<string, string>) => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [error, setError] = useState('');

  const submit = () => {
    const missing = fields.find((f) => f.required && !values[f.key]?.trim());
    if (missing) {
      setError(`${missing.label} is required`);
      return;
    }
    onSubmit(values);
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-3"
      >
        {fields.map((f) => (
          <label key={f.key} className="block text-sm">
            <span className="mb-1 block text-muted">
              {f.label}
              {f.required ? ' *' : ''}
            </span>
            {f.type === 'textarea' ? (
              <textarea
                className={inputCls}
                rows={4}
                value={values[f.key] ?? ''}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              />
            ) : f.type === 'select' ? (
              <select
                className={inputCls}
                value={values[f.key] ?? ''}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              >
                {(f.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={inputCls}
                type={f.type ?? 'text'}
                value={values[f.key] ?? ''}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              />
            )}
          </label>
        ))}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex items-center justify-between pt-2">
          <div>
            {onDelete && (
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  if (window.confirm('Delete this record?')) onDelete();
                }}
              >
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="p-8 text-center text-sm text-muted">{text}</div>;
}
