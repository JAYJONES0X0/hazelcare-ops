import { useState, useEffect } from 'react';
import { ShieldCheck, KeyRound, XCircle } from 'lucide-react';
import { StaffDictationView } from './StaffDictationView';

interface StaffLinkPayload {
  toolId: string;
  linkId?: string;
  token?: string;
}

function parseHash(): StaffLinkPayload | null {
  const hash = window.location.hash;
  const match = hash.match(/^#staff\/(\w+)\?(.+)$/);
  if (!match) return null;
  const toolId = match[1];
  const params = new URLSearchParams(match[2]);
  return {
    toolId,
    linkId: params.get('id') || undefined,
    token: params.get('t') || undefined,
  };
}

type GateState = 'loading' | 'code-entry' | 'verified' | 'expired' | 'error';

export function StaffAccessGate() {
  const [payload, setPayload] = useState<StaffLinkPayload | null>(null);
  const [gateState, setGateState] = useState<GateState>('loading');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [staffName, setStaffName] = useState('');

  const verify = async (p: StaffLinkPayload, fullCode: string, name: string) => {
    setVerifying(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/staff/verify-staff-link', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.linkId, token: p.token, code: fullCode, toolId: p.toolId }),
      });
      const data = await res.json();
      if (data.valid) {
        setGateState('verified');
        sessionStorage.setItem('hc_staff_name', name);
      } else {
        setGateState('code-entry');
        setErrorMsg(data.reason === 'expired' ? 'This link has expired. Please ask for a new one.' : 'That code didn\'t work. Check it and try again.');
      }
    } catch {
      setGateState('code-entry');
      setErrorMsg('Could not connect. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    const p = parseHash();
    if (!p) { setGateState('error'); return; }

    const savedName = sessionStorage.getItem('hc_staff_name') || '';
    setStaffName(savedName);
    setPayload(p);

    // Check if already verified via cookie
    fetch(`/api/staff/staff-sac-status?toolId=${p.toolId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => setGateState(data.ok ? 'verified' : 'code-entry'))
      .catch(() => setGateState('code-entry'));
  }, []);

  const handleCodeSubmit = () => {
    const fullCode = code.trim();
    if (fullCode.replace(/[^A-Z0-9]/gi, '').length < 8 || !payload) return;
    void verify(payload, fullCode, staffName);
  };

  if (gateState === 'verified') {
    return <StaffDictationView hideHeader toolId={payload?.toolId} staffName={staffName} />;
  }

  return (
    <div className="flex flex-col min-h-dvh bg-hc-surface safe-area px-5">
      {(gateState === 'loading' || verifying) && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-8 h-8 border-2 border-hc-teal border-t-transparent rounded-full animate-spin" />
          {verifying && <p className="text-[10px] font-black text-hc-muted uppercase tracking-widest">Signing you in...</p>}
        </div>
      )}

      {gateState === 'code-entry' && !verifying && (
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full gap-8">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-hc-teal/10 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-8 h-8 text-hc-teal" />
            </div>
            <h1 className="text-xl font-black text-hc-text tracking-tight">
              {staffName ? `Hi ${staffName}` : 'Welcome'}
            </h1>
            <p className="text-[11px] font-bold text-hc-muted leading-relaxed">
              Paste or type the code from your message to start dictating.
            </p>
          </div>

          <div className="space-y-5">
            <input
              value={staffName}
              onChange={e => setStaffName(e.target.value)}
              placeholder="Your name..."
              autoComplete="off"
              className="w-full hc-clay-inset px-5 py-4 text-sm font-black text-hc-text text-center outline-none shadow-inner rounded-2xl"
            />
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter') handleCodeSubmit(); }}
              placeholder="Access code"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              className="w-full hc-clay-inset px-5 py-5 text-center text-lg font-black tracking-[0.15em] hc-clay-inset rounded-2xl text-hc-text outline-none uppercase"
              style={{ WebkitAppearance: 'none' }}
            />

            {errorMsg && (
              <div className="flex items-center gap-2 justify-center text-flag-red text-[10px] font-bold">
                <XCircle className="w-3.5 h-3.5" />
                {errorMsg}
              </div>
            )}

            <button
              onClick={handleCodeSubmit}
              disabled={code.replace(/[^A-Z0-9]/gi, '').length < 8}
              className="w-full py-4 rounded-2xl bg-hc-teal text-hc-bone text-[11px] font-black uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-40"
            >
              <KeyRound className="w-4 h-4" />
              Access Studio
            </button>
          </div>
        </div>
      )}

      {gateState === 'expired' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 max-w-sm mx-auto">
          <XCircle className="w-12 h-12 text-flag-red" />
          <p className="text-sm font-bold text-hc-text">Link expired</p>
          <p className="text-[11px] text-hc-muted">Your access link has expired. Please ask the coordinator to send a new one.</p>
        </div>
      )}

      {gateState === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 max-w-sm mx-auto">
          <XCircle className="w-12 h-12 text-flag-red" />
          <p className="text-sm font-bold text-hc-text">Invalid link</p>
        </div>
      )}
    </div>
  );
}
