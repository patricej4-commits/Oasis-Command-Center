'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    const supabase = createClient();
    const { data: allowed, error: rpcErr } = await supabase.rpc('is_allowed_email', { p_email: email });
    if (rpcErr || !allowed) {
      setBusy(false);
      setMsg('This email does not have access.');
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) setMsg(error.message);
    else setStep('code');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    const { error } = await createClient().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setMsg('That code did not work. Check the latest email and try again.');
    else window.location.href = '/';
  }

  const input = 'mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base';
  if (step === 'code') {
    return (
      <form onSubmit={verify} className="mt-5 space-y-3">
        <p className="text-sm text-slate-600">
          We sent an email to <b>{email}</b>. Tap the link in it, or enter the 6-digit code here.
          On a phone home screen app, the code is the most reliable option.
        </p>
        <input className={input + ' text-center text-2xl tracking-[0.4em]'} inputMode="numeric" autoComplete="one-time-code"
          maxLength={8} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} />
        {msg && <p className="text-sm font-semibold text-red-600">{msg}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-oasis py-3 text-lg font-bold text-white disabled:opacity-60">
          {busy ? 'Checking...' : 'Sign in'}
        </button>
        <button type="button" className="w-full text-sm font-semibold text-slate-500" onClick={() => setStep('email')}>
          Use a different email
        </button>
      </form>
    );
  }
  return (
    <form onSubmit={sendLink} className="mt-5 space-y-3">
      <label className="block text-sm font-semibold">
        Email
        <input className={input} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {msg && <p className="text-sm font-semibold text-red-600">{msg}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-oasis py-3 text-lg font-bold text-white disabled:opacity-60">
        {busy ? 'Sending...' : 'Email me a sign-in link'}
      </button>
    </form>
  );
}
