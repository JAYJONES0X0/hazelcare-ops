import { useState, useEffect, useCallback, Component, type ReactNode, type ErrorInfo } from 'react';
import { ORG_CONFIG } from './lib/config';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e?.message || String(e) }; }
  componentDidCatch(e: Error, info: ErrorInfo) { console.error('[ErrorBoundary]', e, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 mesh-bg gap-4">
          <div className="text-flag-red font-black text-lg">App crashed</div>
          <pre className="text-hc-muted text-xs bg-black/40 p-4 rounded-xl max-w-xl overflow-auto">{this.state.error}</pre>
          <button onClick={() => this.setState({ error: null })} className="btn-gradient px-6 py-2 rounded-xl text-xs font-black">Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Staff share link pages — these can be opened standalone via hash
const STAFF_PAGES: Record<string, Page> = {
  'notes': 'notes',
  'handover': 'handover',
  'actions': 'actions',
  'incidents': 'incidents',
};

function LoginGate({
  onUnlock,
  sacRequired,
  staffToolId,
  staffToken,
  staffLinkId,
  onStaffSacComplete,
  clearStaffUrlToken,
}: {
  onUnlock: (opts?: { staffScoped?: boolean }) => void;
  sacRequired?: boolean;
  staffToolId?: string | null;
  staffToken?: string | null;
  staffLinkId?: string | null;
  onStaffSacComplete?: () => void;
  clearStaffUrlToken?: () => void;
}) {
  const inStaffFlow = !!sacRequired || !!staffToolId;
  const initialStep: 'credentials' | 'email' | 'code' | 'sac' = sacRequired ? 'sac' : 'email';
  const [step, setStep] = useState<'credentials' | 'email' | 'code' | 'sac'>(initialStep);
  const [sac, setSac] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Keep staff-link auth flow coherent when SAC requirement changes.
  useEffect(() => {
    if (sacRequired) {
      setStep('sac');
      return;
    }
    if (staffToolId && (step === 'sac' || step === 'credentials' || step === 'code')) {
      setStep('email');
    }
  }, [sacRequired, staffToolId, step]);

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data?.ok) {
        setError('');
        onUnlock({ staffScoped: inStaffFlow });
      } else {
        setError(data?.error || 'Invalid password');
        setPassword('');
      }
    } catch {
      setError('Could not verify credentials');
    } finally {
      setLoading(false);
    }
  }

  function handleSac(e: React.FormEvent) {
    e.preventDefault();
    const formatted = sac.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 12);
    if ((!staffToken && !staffLinkId) || !staffToolId) {
      setError('Invalid or expired staff link');
      return;
    }
    setLoading(true);
    setError('');
    // Send short id if available (clean URL), otherwise fall back to full token
    const body = staffLinkId
      ? { id: staffLinkId, code: formatted, toolId: staffToolId }
      : { token: staffToken, code: formatted, toolId: staffToolId };
    fetch('/api/staff/verify-staff-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => {
        if (formatted.length === 12 && data.valid) {
          clearStaffUrlToken?.();
          onStaffSacComplete?.();
          setStep('email');
        } else {
          setError('Invalid or expired access code');
        }
      })
      .catch(() => setError('Could not verify access code'))
      .finally(() => setLoading(false));
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) { setError('Enter a valid email'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, probe: true }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data?.recognized) {
        setError('Email not recognised. Contact admin for access.');
        return;
      }
      setStep('credentials');
    } catch {
      setError('Could not verify email. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const customLogo = localStorage.getItem('hc-custom-logo-v1');
  const stepLabel = step === 'sac' ? 'Staff Access' : step === 'credentials' ? 'Welcome back' : 'Sign in';
  const stepSub = step === 'sac' ? 'Enter your secure access code' : step === 'credentials' ? 'Enter your password to continue' : 'Enter your work email address';

  const inputClass = "w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/25 focus:outline-none focus:border-hc-teal/60 transition-colors text-sm font-medium";

  return (
    <div className="min-h-screen flex relative overflow-hidden" style={{ isolation: 'isolate' }}>

      {/* Left panel — brand / info (hidden on mobile) */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-10 relative"
        style={{ background: 'linear-gradient(160deg,rgba(10,14,22,0.97) 0%,rgba(6,9,16,0.99) 100%)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Top — logo + name */}
        <div>
          <div className="flex items-center gap-3 mb-14">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
              style={{ background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.2)' }}>
              <img src={customLogo || ORG_CONFIG.logoIcon} alt="Logo" className="h-7 w-7 object-contain rounded-lg" />
            </div>
            <div>
              <div className="text-sm font-black text-white tracking-tight">{ORG_CONFIG.name}</div>
              <div className="text-[10px] text-hc-teal font-semibold uppercase tracking-widest">Operations Portal</div>
            </div>
          </div>

          <h2 className="text-3xl font-black text-white tracking-tighter leading-tight mb-4">
            Staff-grade ops.<br />
            <span style={{ background: 'linear-gradient(135deg,#14b8a6,#38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              CQC-ready by default.
            </span>
          </h2>
          <p className="text-sm text-hc-muted leading-relaxed mb-10">
            Your complete documentation, safeguarding, and staff intelligence platform — built for supported living.
          </p>

          {/* Feature list */}
          <div className="space-y-3">
            {[
              { label: 'Module-based note quality scoring', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
              { label: 'CQC-aligned safeguarding workflows', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
              { label: 'Staff coaching & escalation scripts', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
              { label: 'Secure staff link sharing via SAC', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.15)' }}>
                  <svg className="w-3.5 h-3.5 text-hc-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={f.icon} /></svg>
                </div>
                <span className="text-xs font-medium text-hc-muted">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom — legal warning card */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <div className="flex items-start gap-3">
            <svg className="w-4 h-4 text-flag-amber shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <div className="text-[10px] font-black text-flag-amber uppercase tracking-widest mb-1">Authorised Staff Only</div>
              <div className="text-[11px] text-flag-amber/70 leading-relaxed">
                This system is for authorised personnel only. Unauthorised access is a criminal offence under the Computer Misuse Act 1990.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm animate-in zoom-in-95 duration-700">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <img src={customLogo || ORG_CONFIG.logoIcon} alt="Logo" className="h-9 w-9 rounded-xl" />
            <div>
              <div className="text-sm font-black text-white">{ORG_CONFIG.name}</div>
              <div className="text-[10px] text-hc-teal/80 font-semibold uppercase tracking-widest">Operations Portal</div>
            </div>
          </div>

          {/* Step heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-black text-white tracking-tighter mb-1">{stepLabel}</h1>
            <p className="text-sm text-hc-muted">{stepSub}</p>
          </div>

          {/* Step progress dots */}
          {!inStaffFlow && (
            <div className="flex items-center gap-2 mb-6">
              {(['email', 'credentials'] as const).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all"
                    style={{
                      background: (step === 'email' && i === 0) || (step === 'credentials' && i <= 1) ? 'rgba(20,184,166,0.2)' : 'rgba(255,255,255,0.04)',
                      border: (step === 'email' && i === 0) || (step === 'credentials' && i <= 1) ? '1px solid rgba(20,184,166,0.5)' : '1px solid rgba(255,255,255,0.08)',
                      color: (step === 'email' && i === 0) || (step === 'credentials' && i <= 1) ? '#14b8a6' : '#475569',
                    }}>
                    {i + 1}
                  </div>
                  {i < 1 && <div className="w-8 h-px" style={{ background: step === 'credentials' ? 'rgba(20,184,166,0.4)' : 'rgba(255,255,255,0.08)' }} />}
                </div>
              ))}
              <span className="text-[10px] text-hc-muted ml-2">{step === 'email' ? 'Verify email' : 'Enter password'}</span>
            </div>
          )}

          {/* Form card */}
          <div className="rounded-2xl p-6 mb-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(24px)' }}>

            {step === 'sac' && (
              <form onSubmit={handleSac} className="flex flex-col gap-5">
                <div>
                  <label className="text-[10px] font-black text-hc-muted uppercase tracking-widest block mb-2">12-Character Access Code</label>
                  <input type="text" value={sac}
                    onChange={e => {
                      const val = e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '');
                      let formatted = '';
                      for (let i = 0; i < val.length && i < 12; i++) {
                        if (i > 0 && i % 4 === 0) formatted += '-';
                        formatted += val[i];
                      }
                      setSac(formatted); setError('');
                    }}
                    placeholder="XXXX-XXXX-XXXX" autoFocus
                    className={`${inputClass} text-center font-black tracking-widest text-base`} />
                </div>
                {error && <div className="text-flag-red text-xs font-semibold text-center">{error}</div>}
                <button type="submit" disabled={loading || sac.replace(/-/g, '').length < 12}
                  className="btn-gradient py-3 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-40 cursor-pointer">
                  {loading ? 'Verifying…' : 'Verify Access Code'}
                </button>
              </form>
            )}

            {step === 'email' && (
              <form onSubmit={handleEmail} className="flex flex-col gap-5">
                <div>
                  <label className="text-[10px] font-black text-hc-muted uppercase tracking-widest block mb-2">Work Email</label>
                  <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                    placeholder={`you@${ORG_CONFIG.domain}`} autoFocus className={inputClass} />
                </div>
                {error && <div className="text-flag-red text-xs font-semibold">{error}</div>}
                <button type="submit" disabled={loading}
                  className="btn-gradient py-3 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-40 cursor-pointer">
                  {loading ? 'Checking…' : 'Continue'}
                </button>
              </form>
            )}

            {step === 'credentials' && (
              <form onSubmit={handlePassword} className="flex flex-col gap-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black text-hc-muted uppercase tracking-widest">Password</label>
                    <span className="text-[10px] text-hc-muted/60">{email}</span>
                  </div>
                  <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                    placeholder="••••••••••" autoFocus className={inputClass} />
                </div>
                {error && <div className="text-flag-red text-xs font-semibold">{error}</div>}
                <button type="submit" disabled={loading}
                  className="btn-gradient py-3 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-40 cursor-pointer">
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
                <button type="button"
                  onClick={() => { setPassword(''); setError(''); setStep('email'); }}
                  className="text-hc-muted text-[10px] font-semibold text-center hover:text-white transition-colors cursor-pointer">
                  ← Use a different email
                </button>
              </form>
            )}
          </div>

          {/* Legal note — mobile only */}
          <p className="text-[10px] text-hc-muted/30 text-center leading-relaxed lg:hidden">
            Authorised staff only · Computer Misuse Act 1990
          </p>
        </div>
      </div>
    </div>
  );
}

import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { UploadPage } from './pages/UploadPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { ActionsPage } from './pages/ActionsPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { StaffPage } from './pages/StaffPage';
import { StaffNotePage } from './pages/StaffNotePage';
import { HandoverPage } from './pages/HandoverPage';
import { BriefingPage } from './pages/BriefingPage';
import { CompliancePage } from './pages/CompliancePage';
import { ReportsPage } from './pages/ReportsPage';
import { RiskScoresPage } from './pages/RiskScoresPage';
import { ClientDocsPage } from './pages/ClientDocsPage';
import { ClientDiaryPage } from './pages/ClientDiaryPage';
import { AgencyPortalPage } from './pages/AgencyPortalPage';
import { StaffMonitoringPage } from './pages/StaffMonitoringPage';
import { SettingsPage } from './pages/SettingsPage';
import { RosterPage } from './pages/RosterPage';
import type { WeekSummary, Action, Incident, StaffMember, Shift } from './lib/types';
import { loadWeekData, saveWeekData, loadActions, saveActions, loadIncidents, saveIncidents, loadStaff, saveStaff, loadShifts, saveShifts } from './lib/storage';


export type Page = 'briefing' | 'dashboard' | 'upload' | 'templates' | 'actions' | 'incidents' | 'staff' | 'roster' | 'notes' | 'handover' | 'compliance' | 'reports' | 'risk' | 'client-docs' | 'client-diary' | 'agency' | 'staff-monitoring' | 'settings';

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [staffScopedAuthed, setStaffScopedAuthed] = useState(false);
  const [page, setPage] = useState<Page>('briefing');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('hc-theme') as 'dark' | 'light') || 'dark');
  const uiScale = 1;
  const [staffMode, setStaffMode] = useState<Page | null>(null);
  const [staffLinkActive, setStaffLinkActive] = useState(false);
  const [sacVerified, setSacVerified] = useState(false);
  const [staffToken, setStaffToken] = useState<string | null>(null);
  const [staffLinkId, setStaffLinkId] = useState<string | null>(null);
  const [staffToolId, setStaffToolId] = useState<string | null>(null);

  const refreshStaffSacFromServer = useCallback(() => {
    if (!staffToolId) return;
    void fetch(`/api/staff/staff-sac-status?toolId=${encodeURIComponent(staffToolId)}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setSacVerified(!!d.ok))
      .catch(() => setSacVerified(false));
  }, [staffToolId]);

  const clearStaffUrlToken = useCallback(() => {
    if (staffToolId) {
      window.history.replaceState(null, '', `#staff/${staffToolId}`);
    }
    setStaffToken(null);
    setStaffLinkId(null);
  }, [staffToolId]);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/auth/session', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { authed?: boolean; staffScoped?: boolean }) => {
        if (cancelled) return;
        if (d?.authed) setAuthed(true);
        setStaffScopedAuthed(!!d?.staffScoped);
        setSessionLoaded(true);
      })
      .catch(() => { if (!cancelled) setSessionLoaded(true); });
    return () => {
      cancelled = true;
    };
  }, []);

  // Check for staff share link on load: #staff/notes?t=<signed_token>
  useEffect(() => {
    function checkHash() {
      const hash = window.location.hash;
      const match = hash.match(/^#staff\/(\w+)/);
      const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
      const token = urlParams.get('t');   // legacy: full jwt in URL
      const linkId = urlParams.get('id'); // new: short redis-backed ID

      if (match && STAFF_PAGES[match[1]]) {
        setStaffMode(STAFF_PAGES[match[1]]);
        setStaffLinkActive(true);
        setStaffToolId(match[1]);
        setStaffLinkId(linkId || null);
        setStaffToken(token || null);
      } else {
        void fetch('/api/staff/staff-sac-status', { method: 'DELETE', credentials: 'include' });
        setStaffMode(null);
        setStaffLinkActive(false);
        setStaffToken(null);
        setStaffLinkId(null);
        setStaffToolId(null);
        setSacVerified(false);
      }
    }
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  useEffect(() => {
    if (!staffLinkActive || !staffToolId) {
      return;
    }
    let cancelled = false;
    (async () => {
      if (staffToken || staffLinkId) {
        await fetch('/api/staff/staff-sac-status', { method: 'DELETE', credentials: 'include' });
      }
      const r = await fetch(`/api/staff/staff-sac-status?toolId=${encodeURIComponent(staffToolId)}`, { credentials: 'include' });
      const d = await r.json();
      if (!cancelled) setSacVerified(!!d.ok);
    })();
    return () => {
      cancelled = true;
    };
  }, [staffLinkActive, staffToolId, staffToken, staffLinkId]);

  useEffect(() => {
    // Dark-only: always remove light class
    document.documentElement.classList.remove('theme-light');
    localStorage.setItem('hc-theme', 'dark');
  }, []);

  useEffect(() => {
    const safe = [0.85, 0.9, 1, 1.1].includes(uiScale) ? uiScale : 1;
    document.documentElement.style.fontSize = `${16 * safe}px`;
    localStorage.setItem('hc-ui-scale', String(safe));
  }, [uiScale]);

  const generateStaffLink = useCallback(async (toolId: string) => {
    const res = await fetch('/api/staff/issue-staff-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolId }),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to create secure staff link');
    const data = await res.json();
    return { link: data.link as string, code: data.code as string };
  }, []);

  // Staff-link SAC cookies must never let a scoped session bleed into the full Ops shell.
  // MUST be before any early returns — hooks cannot be called after conditional returns.
  useEffect(() => {
    if (!authed) return;
    if (staffScopedAuthed && !(staffLinkActive && staffMode)) {
      void fetch('/api/staff/staff-sac-status', { method: 'DELETE', credentials: 'include' });
      setStaffScopedAuthed(false);
    }
  }, [authed, staffScopedAuthed, staffLinkActive, staffMode]);

  if (!sessionLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center mesh-bg">
        <div className="w-12 h-12 rounded-full border-4 border-hc-teal/20 border-t-hc-teal animate-spin" />
      </div>
    );
  }

  if (!authed) {
    return (
      <LoginGate
        onUnlock={(opts) => {
          setAuthed(true);
          setStaffScopedAuthed(!!opts?.staffScoped);
        }}
        sacRequired={staffLinkActive && !sacVerified}
        staffToken={staffToken}
        staffLinkId={staffLinkId}
        staffToolId={staffToolId}
        onStaffSacComplete={refreshStaffSacFromServer}
        clearStaffUrlToken={clearStaffUrlToken}
      />
    );
  }

  // Staff standalone mode — minimal layout, just the tool
  if (staffLinkActive && staffMode) {
    return (
      <StaffStandaloneView
        page={staffMode}
        onSignOut={async () => {
          await fetch('/api/auth/session', { method: 'DELETE', credentials: 'include' });
          await fetch('/api/staff/staff-sac-status', { method: 'DELETE', credentials: 'include' });
          setAuthed(false);
          setStaffScopedAuthed(false);
          setStaffLinkActive(false);
          setStaffMode(null);
          setStaffToken(null);
          setStaffToolId(null);
          setSacVerified(false);
          window.location.hash = '';
        }}
      />
    );
  }

  // While we're clearing a stale SAC cookie, hold on the spinner — never render a blank screen.
  if (staffScopedAuthed && !(staffLinkActive && staffMode)) {
    return (
      <div className="min-h-screen flex items-center justify-center mesh-bg">
        <div className="w-12 h-12 rounded-full border-4 border-hc-teal/20 border-t-hc-teal animate-spin" />
      </div>
    );
  }

  async function handleSignOut() {
    await fetch('/api/auth/session', { method: 'DELETE', credentials: 'include' });
    setAuthed(false);
    setStaffScopedAuthed(false);
  }

  return <ErrorBoundary><FullApp page={page} setPage={setPage} generateStaffLink={generateStaffLink} theme={theme} setTheme={setTheme} onSignOut={handleSignOut} /></ErrorBoundary>;
}

function StaffStandaloneView({ page, onSignOut }: { page: Page; onSignOut: () => void }) {
  const [weekData] = useState<WeekSummary | null>(() => loadWeekData());
  const [actions, setActions] = useState<Action[]>(() => loadActions());
  const [incidents, setIncidents] = useState<Incident[]>(() => loadIncidents());

  const TOOL_LABELS: Record<string, string> = {
    notes: 'Note Assistant',
    handover: 'Shift Handover',
    actions: 'Action Tracker',
    incidents: 'Incidents',
  };

  return (
    <div className="min-h-screen mesh-bg flex flex-col overflow-hidden">
      {/* Minimal header */}
      <div className="glass border-b border-white/10 px-6 py-4 flex items-center justify-between z-20 shadow-2xl backdrop-blur-3xl">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl glass border border-white/10 flex items-center justify-center shadow-lg glow-teal">
            <img src={ORG_CONFIG.logoIcon} alt={ORG_CONFIG.name} className="h-6 w-6 rounded-md" />
          </div>
          <div>
            <div className="text-base font-black text-white tracking-tighter uppercase text-shimmer">{TOOL_LABELS[page] || 'Staff Tool'}</div>
            <div className="text-[10px] font-black text-hc-teal-light uppercase tracking-widest">{ORG_CONFIG.name} — Staff Access</div>
          </div>
        </div>
        <button onClick={onSignOut}
          className="group flex items-center gap-2.5 px-5 py-2.5 glass-light border border-white/10 text-hc-muted hover:text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all hover:bg-white/5 hover:border-hc-teal/30 shadow-xl">
          Sign Out
        </button>
      </div>

      {/* Tool content with responsive sizing fix */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 scrollbar-thin">
        <div className="max-w-6xl mx-auto">
          {page === 'notes' && <StaffNotePage />}
          {page === 'handover' && <HandoverPage weekData={weekData} />}
          {page === 'actions' && <ActionsPage actions={actions} onUpdate={(u) => { setActions(u); saveActions(u); }} />}
          {page === 'incidents' && <IncidentsPage incidents={incidents} onUpdate={(u) => { setIncidents(u); saveIncidents(u); }} />}
        </div>
      </div>
    </div>
  );
}

function FullApp({ page, setPage, generateStaffLink, theme, setTheme, onSignOut }: { page: Page; setPage: (p: Page) => void; generateStaffLink: (id: string) => Promise<{ link: string; code: string }>; theme: 'dark' | 'light'; setTheme: (t: 'dark' | 'light') => void; onSignOut: () => void }) {
  const [weekData, setWeekData] = useState<WeekSummary | null>(() => loadWeekData());
  const [actions, setActions] = useState<Action[]>(() => loadActions());
  const [incidents, setIncidents] = useState<Incident[]>(() => loadIncidents());
  const [staff, setStaff] = useState<StaffMember[]>(() => loadStaff());
  const [shifts, setShifts] = useState<Shift[]>(() => loadShifts());
  const [showShareModal, setShowShareModal] = useState<string | null>(null);

  function handleDataParsed(data: WeekSummary) {
    setWeekData(data);
    saveWeekData(data);
    setPage('dashboard');
  }

  function handleUpdateActions(updated: Action[]) {
    setActions(updated);
    saveActions(updated);
  }

  function handleUpdateIncidents(updated: Incident[]) {
    setIncidents(updated);
    saveIncidents(updated);
  }

  function handleUpdateStaff(updated: StaffMember[]) {
    setStaff(updated);
    saveStaff(updated);
  }

  function handleUpdateShifts(updated: Shift[]) {
    setShifts(updated);
    saveShifts(updated);
  }

  async function copyStaffLink(toolId: string) {
    try {
      const { link, code } = await generateStaffLink(toolId);
      const payload = `${ORG_CONFIG.name} staff access\nLink: ${link}\nSecure Access Code: ${code}`;
      await navigator.clipboard.writeText(payload);
      setShowShareModal(toolId);
      setTimeout(() => setShowShareModal(null), 2000);
    } catch {
      setShowShareModal('error');
      setTimeout(() => setShowShareModal(null), 2000);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{background:'transparent'}}>
      <Sidebar
        page={page}
        setPage={setPage}
        weekData={weekData}
        actions={actions}
        incidents={incidents}
        theme={theme}
        setTheme={setTheme}
        onSignOut={onSignOut}
      />
      <main className="flex-1 overflow-y-auto lg:h-full mesh-bg relative scrollbar-thin">
        {/* Staff share buttons on Staff Tools pages */}
        {(page === 'notes' || page === 'handover' || page === 'actions' || page === 'incidents') && (
          <div className="px-6 pt-6 flex justify-end animate-in fade-in duration-1000 relative z-20">
            <button
              onClick={() => copyStaffLink(page)}
              className="group flex items-center gap-3 px-6 py-3 glass-light border border-white/10 text-hc-muted hover:text-hc-teal-light text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all hover:bg-white/5 hover:border-hc-teal/30 shadow-xl"
            >
              <svg className={`w-4 h-4 transition-transform ${showShareModal === page ? 'scale-125 text-flag-green' : 'group-hover:rotate-12'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              {showShareModal === page ? 'Link Copied' : 'Share Staff Link'}
            </button>
          </div>
        )}

        <div className="relative z-10 w-full min-h-screen">
          {page === 'briefing' && <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700"><BriefingPage weekData={weekData} actions={actions} incidents={incidents} setPage={setPage} /></div>}
          {page === 'dashboard' && <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700"><Dashboard weekData={weekData} setPage={setPage} actions={actions} incidents={incidents} staff={staff} shifts={shifts} /></div>}
          {page === 'upload' && <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700"><UploadPage onDataParsed={handleDataParsed} setPage={setPage} /></div>}
          {page === 'templates' && <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700"><TemplatesPage weekData={weekData} /></div>}
          {page === 'actions' && <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700"><ActionsPage actions={actions} onUpdate={handleUpdateActions} /></div>}
          {page === 'incidents' && <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700"><IncidentsPage incidents={incidents} onUpdate={handleUpdateIncidents} /></div>}
          {page === 'staff' && <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700"><StaffPage staff={staff} onUpdate={handleUpdateStaff} /></div>}
          {page === 'roster' && <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700"><RosterPage staff={staff} shifts={shifts} onUpdateShifts={handleUpdateShifts} /></div>}
          {page === 'notes' && <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700"><StaffNotePage /></div>}
          {page === 'handover' && <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700"><HandoverPage weekData={weekData} /></div>}
          {page === 'compliance' && <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700"><CompliancePage staff={staff} onUpdate={handleUpdateStaff} /></div>}
          {page === 'reports' && <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700"><ReportsPage weekData={weekData} setPage={setPage} /></div>}
          {page === 'risk' && <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700"><RiskScoresPage weekData={weekData} /></div>}
          {page === 'client-docs' && <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700"><ClientDocsPage /></div>}
          {page === 'client-diary' && <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700"><ClientDiaryPage weekData={weekData} setPage={setPage} /></div>}
          {page === 'agency' && <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700"><AgencyPortalPage /></div>}
          {page === 'staff-monitoring' && (
            <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
              <StaffMonitoringPage staff={staff} weekData={weekData} setPage={setPage} onDataParsed={(data) => { setWeekData(data); saveWeekData(data); }} />
            </div>
          )}
          {page === 'settings' && (
            <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
              <SettingsPage onSignOut={onSignOut} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
