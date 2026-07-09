'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';

export default function SignInPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('receptionist@caskinetteford.com');
  const [password, setPassword] = useState('');

  return (
    <div className="page-bg flex min-h-screen items-center justify-center p-6">
      <form
        className="surface w-full max-w-md rounded-3xl p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          await signIn({ email, password });
          router.push('/dashboard');
        }}
      >
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Caskinette Ford</div>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Permit Packet Tracker</h1>
        <p className="mt-2 text-sm text-slate-600">Receptionist access for batch entry, search, printing, and history.</p>
        <div className="mt-6 space-y-4">
          <input className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-3" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-3" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
          <button className="w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white shadow-sm hover:bg-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Sign in</button>
        </div>
      </form>
    </div>
  );
}
