'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, inputCls, Card, PageHeader } from '@/components/ui';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function SignInPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'signin', email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid credentials');
        setLoading(false);
        return;
      }
      toast.success('Signed in');
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
        <PageHeader title="Sign in" subtitle="Welcome back to Sales OS" />
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label className="block text-sm text-muted">Email</label>
            <input name="email" type="email" required className={inputCls} placeholder="you@company.com" />
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-muted">Password</label>
            <input name="password" type="password" required className={inputCls} placeholder="••••••••" />
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500 border border-red-500/20">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="text-brand hover:underline font-medium">
            Create one
          </Link>
        </p>
      </Card>
    </div>
  );
}
