import { useState } from 'react';
import type { FormEvent } from 'react';
import { authRequest, confirmAuthSession } from '../lib/auth-client';
import { enableLocalPreviewAuth, isJsonResponse, isMissingLocalApiResponse } from '../lib/local-preview-auth';

type VerificationMethod = 'totp' | 'telegram' | 'recovery';
const METHOD_NAMES: Record<VerificationMethod, string> = { totp: 'Authenticator app', telegram: 'Access code', recovery: 'Recovery code' };

export function LoginGate({ onUnlock }: { onUnlock: (role?: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [methods, setMethods] = useState<VerificationMethod[]>([]);
  const [method, setMethod] = useState<VerificationMethod>('totp');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const complete = async () => {
    const session = await confirmAuthSession();
    localStorage.setItem('hc-user-role', session.role);
    onUnlock(session.role);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (methods.length) {
        if (method === 'telegram' && !token) throw new Error('Request an access code first.');
        const response = await authRequest(method === 'telegram' ? 'verify-code' : 'verify-backup', method === 'telegram' ? { code: code.trim(), token } : { code: code.trim(), method });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.valid) throw new Error(payload.error || 'The verification code is incorrect or expired.');
        await complete();
        return;
      }
      const response = await authRequest('login', { email, password });
      if (isMissingLocalApiResponse(response)) {
        if (!email.trim() || !password.trim()) throw new Error('Enter local preview credentials.');
        enableLocalPreviewAuth('admin');
        onUnlock('admin');
        return;
      }
      const payload = isJsonResponse(response) ? await response.json().catch(() => ({})) : {};
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not sign in. Check your credentials and retry.');
      if (payload.requires2fa) {
        const available = (Array.isArray(payload.methods) ? payload.methods : []).filter((value: unknown): value is VerificationMethod => value === 'totp' || value === 'telegram' || value === 'recovery');
        if (!available.length) throw new Error('Verification is not configured. Contact the administrator.');
        setMethods(available);
        setMethod(available[0]);
        setPassword('');
        return;
      }
      await complete();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not sign in. Please retry.');
    } finally {
      setBusy(false);
    }
  };

  const sendCode = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await authRequest('send-code', {});
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.token) throw new Error(payload.error || 'Could not deliver the access code.');
      setToken(payload.token);
      setNotice('Code sent to the configured access channel.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not deliver the access code.');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-hc-bg p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm hc-clay-raised p-10 space-y-8 rounded-[3rem] shadow-2xl border border-hc-muted/5">
        <div>
          <h1 className="text-2xl font-black text-hc-text uppercase tracking-tighter">OVSITE Access</h1>
          <p className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] mt-2">{methods.length ? 'Verify your sign-in' : 'Enter credentials to open the OVSITE intelligence hub'}</p>
        </div>
        <div className="space-y-4">
          {!methods.length ? <>
            <label className="block space-y-2">
              <span className="text-[9px] font-black text-hc-muted uppercase tracking-widest">Email</span>
              <input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="Email" autoComplete="username" className="w-full hc-clay-inset px-6 py-4 text-sm font-black text-hc-text focus:outline-none focus:ring-2 focus:ring-hc-teal/40" />
            </label>
            <label className="block space-y-2">
              <span className="text-[9px] font-black text-hc-muted uppercase tracking-widest">Access Key</span>
              <input type="password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Access Key" autoComplete="current-password" className="w-full hc-clay-inset px-6 py-4 text-sm font-black text-hc-text focus:outline-none focus:ring-2 focus:ring-hc-teal/40" />
            </label>
          </> : <>
            <label className="block space-y-2">
              <span className="text-[9px] font-black text-hc-muted uppercase tracking-widest">Verification method</span>
              <select value={method} onChange={event => { setMethod(event.target.value as VerificationMethod); setCode(''); setError(''); }} className="w-full hc-clay-inset px-4 py-3 text-sm text-hc-text">
                {methods.map(value => <option key={value} value={value}>{METHOD_NAMES[value]}</option>)}
              </select>
            </label>
            {method === 'telegram' && <button type="button" disabled={busy} onClick={sendCode} className="text-sm text-hc-teal underline disabled:opacity-50">{token ? 'Send a new access code' : 'Send access code'}</button>}
            <label className="block space-y-2">
              <span className="text-[9px] font-black text-hc-muted uppercase tracking-widest">Verification code</span>
              <input required value={code} onChange={event => setCode(event.target.value)} autoComplete="one-time-code" inputMode={method === 'recovery' ? 'text' : 'numeric'} maxLength={method === 'recovery' ? 64 : 6} className="w-full hc-clay-inset px-6 py-4 text-sm font-black text-hc-text focus:outline-none focus:ring-2 focus:ring-hc-teal/40" />
            </label>
            <button type="button" disabled={busy} onClick={() => { setMethods([]); setCode(''); setToken(''); setError(''); setNotice(''); }} className="text-sm text-hc-muted underline">Back to sign-in</button>
          </>}
        </div>
        {notice && <p role="status" className="text-xs text-hc-teal">{notice}</p>}
        {error && <p role="alert" className="text-xs text-flag-red">{error}</p>}
        <button type="submit" disabled={busy} className="w-full py-5 btn-tactical text-hc-bg rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-xl disabled:opacity-50">{busy ? 'Checking…' : methods.length ? 'Verify and open hub' : 'Open Operations Hub'}</button>
      </form>
    </div>
  );
}
