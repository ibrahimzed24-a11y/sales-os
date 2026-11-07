'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, inputCls, Card, PageHeader } from '@/components/ui';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function SignUpPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'signup', name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }
      try {
        // A brand-new account starts with an empty browser cache.
        localStorage.removeItem('sales-os-store');
        localStorage.setItem('sales-os-uid', data.user?.id ?? '');
      } catch {
        /* ignore */
      }
      toast.success('Account created');
      router.push('/');
      router.refresh();
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <Card className="w-full max-w-md p-8">
        <PageHeader title="Create account" subtitle="Get started with Sales OS" />
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label className="block text-sm text-muted">Full name</label>
            <input name="name" type="text" required maxLength={100} autoComplete="name" className={inputCls} placeholder="Jane Doe" />
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-muted">Email</label>
            <input name="email" type="email" required autoComplete="email" className={inputCls} placeholder="you@company.com" />
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-muted">Password</label>
            <input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className={inputCls} placeholder="••••••••" />
          </div>
          <p className="text-xs text-muted">Use at least 8 characters for your password.</p>
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500 border border-red-500/20">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link href="/auth/signin" className="text-brand hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
