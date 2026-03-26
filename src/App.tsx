import { useState, useEffect, useCallback } from 'react';

// Staff share link pages — these can be opened standalone via hash
const STAFF_PAGES: Record<string, Page> = {
  'notes': 'notes',
  'handover': 'handover',
  'actions': 'actions',
  'incidents': 'incidents',
};

function LoginGate({ onUnlock, sacRequired, staffToolId, staffToken }: { onUnlock: () => void; sacRequired?: boolean; staffToolId?: string | null; staffToken?: string | null }) {
  const [step, setStep] = useState<'password' | 'email' | 'code' | 'sac'>(sacRequired ? 'sac' : 'password');
  const [sac, setSac] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [codeMethod, setCodeMethod] = useState<'otp' | 'totp' | 'recovery'>('otp');
  const [otpUnavailable, setOtpUnavailable] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-switch to SAC if required
  useEffect(() => {
    if (sacRequired) setStep('sac');
  }, [sacRequired]);

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data?.ok) {
        setError('');
        setStep('email');
      } else {
        setError('Incorrect password');
        setPassword('');
      }
    } catch {
      setError('Could not verify password');
    } finally {
      setLoading(false);
    }
  }

  function handleSac(e: React.FormEvent) {
    e.preventDefault();
    const formatted = sac.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 12);
    if (!staffToken || !staffToolId) {
      setError('Invalid or expired staff link');
      return;
    }
    setLoading(true);
    setError('');
    fetch('/api/verify-staff-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: staffToken, code: formatted, toolId: staffToolId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (formatted.length === 12 && data.valid) {
          sessionStorage.setItem('hc-sac-verified', '1');
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
      const res = await fetch('/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok || !data.token) throw new Error('Failed');
      setToken(data.token);
      setCodeMethod('otp');
      setOtpUnavailable(false);
      setStep('code');
    } catch {
      setOtpUnavailable(true);
      setCodeMethod('totp');
      setError('OTP delivery is unavailable. Use Authenticator or Emergency Code.');
      setStep('code');
    } finally {
      setLoading(false);
    }
  }

  async function handleCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let valid = false;
      if (codeMethod === 'otp') {
        const res = await fetch('/api/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, token })
        });
        const data = await res.json();
        valid = !!data.valid;
      } else {
        const res = await fetch('/api/verify-backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, method: codeMethod })
        });
        const data = await res.json();
        valid = !!data.valid;
      }

      if (valid) {
        onUnlock();
      } else {
        setError(codeMethod === 'otp' ? 'Invalid or expired code' : 'Invalid backup code');
        setCode('');
      }
    } catch {
      setError('Verification failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const warning = (
    <div className="bg-flag-red/5 border border-flag-red/30 rounded-2xl px-6 py-4 text-center mb-4 animate-in shake duration-500 shadow-2xl glow-red">
      <div className="text-flag-red text-[10px] font-black uppercase tracking-[0.2em] mb-1.5 flex items-center justify-center gap-2">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
        Staff Access Only
      </div>
      <div className="text-hc-text text-[11px] font-medium leading-relaxed opacity-80 italic">"This system is for authorised staff only. Unauthorised access is prohibited under the Computer Misuse Act 1990."</div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center mesh-bg relative overflow-hidden p-6">
      {/* Ambient orbs */}
      <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-hc-teal/5 rounded-full blur-[120px] animate-float" />
      <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-hc-blue/5 rounded-full blur-[120px] animate-float" style={{ animationDelay: '2s' }} />
      <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-hc-purple/5 rounded-full blur-[100px]" />

      <div className="flex flex-col gap-4 w-full max-w-sm relative z-10 animate-in zoom-in-95 duration-1000">
        <div className="text-center mb-2">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-3xl glass border-2 border-white/10 flex items-center justify-center shadow-2xl glow-teal animate-float">
              <img src="/logo-icon-dark.png" alt="Hazelcare" className="h-12 w-12 rounded-xl" />
            </div>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter text-shimmer leading-none mb-2 uppercase">Hazel Care</h1>
          <p className="text-hc-muted text-[10px] font-black uppercase tracking-[0.3em] opacity-60">
            {step === 'sac' && 'Staff Access Code'}
            {step === 'password' && 'Sign In'}
            {step === 'email' && 'Staff Verification'}
            {step === 'code' && `Verification`}
          </p>
        </div>

        {warning}

        <div className="glass border border-white/5 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden backdrop-blur-3xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-hc-teal/40 to-transparent" />
          
          {step === 'sac' && (
            <form onSubmit={handleSac} className="flex flex-col gap-6">
              <div className="group">
                <label className="section-header text-[9px] mb-2 ml-1 block opacity-40">12-CHARACTER ACCESS CODE</label>
                <input type="text" value={sac} 
                  onChange={e => { 
                    const val = e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '');
                    let formatted = '';
                    for(let i=0; i<val.length && i<12; i++) {
                      if(i > 0 && i % 4 === 0) formatted += '-';
                      formatted += val[i];
                    }
                    setSac(formatted); 
                    setError(''); 
                  }}
                  placeholder="XXXX-XXXX-XXXX" autoFocus
                  className="w-full bg-hc-dark/60 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-hc-muted/20 focus:outline-none focus:border-hc-teal/50 shadow-inner text-center font-black tracking-widest text-lg" />
              </div>
              {error && <div className="text-flag-red text-[10px] font-black uppercase text-center animate-in shake duration-300">{error}</div>}
              <button type="submit" disabled={loading || sac.replace(/-/g, '').length < 12} className="btn-gradient py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50">{loading ? 'VERIFYING...' : 'Verify Access'}</button>
            </form>
          )}

          {step === 'password' && !sacRequired && (
            <form onSubmit={handlePassword} className="flex flex-col gap-6">
              <div className="group">
                <label className="section-header text-[9px] mb-2 ml-1 block opacity-40">PASSWORD</label>
                <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="Enter password..." autoFocus
                  className="w-full bg-hc-dark/60 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-hc-muted/20 focus:outline-none focus:border-hc-teal/50 shadow-inner text-center font-black tracking-widest" />
              </div>
              {error && <div className="text-flag-red text-[10px] font-black uppercase text-center animate-in shake duration-300">{error}</div>}
              <button type="submit" disabled={loading} className="btn-gradient py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50">
                {loading ? 'VERIFYING...' : 'Sign In'}
              </button>
            </form>
          )}

          {step === 'email' && (
            <form onSubmit={handleEmail} className="flex flex-col gap-6">
              <div className="group">
                <label className="section-header text-[9px] mb-2 ml-1 block opacity-40">EMAIL ADDRESS</label>
                <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                  placeholder="staff@hazelcare.co.uk" autoFocus
                  className="w-full bg-hc-dark/60 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-hc-muted/20 focus:outline-none focus:border-hc-teal/50 shadow-inner text-center font-bold" />
              </div>
              {error && <div className="text-flag-red text-[10px] font-black uppercase text-center animate-in shake duration-300">{error}</div>}
              <button type="submit" disabled={loading} className="btn-gradient py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50">
                {loading ? 'SENDING...' : 'Send Code'}
              </button>
              <button type="button" onClick={() => setStep('password')} className="text-hc-muted text-[10px] font-black uppercase tracking-[0.2em] text-center hover:text-white transition-all">← Back</button>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={handleCode} className="flex flex-col gap-6">
              <div className="bg-hc-teal/5 border border-hc-teal/20 rounded-2xl px-5 py-3 text-center mb-2">
                <div className="text-hc-teal-light text-[10px] font-black uppercase tracking-widest leading-relaxed">
                  {codeMethod === 'otp' && 'Verification code sent. Enter it below.'}
                  {codeMethod === 'totp' && 'Enter 6-digit Authenticator code.'}
                  {codeMethod === 'recovery' && 'Enter your emergency recovery code.'}
                </div>
              </div>
              <div className="flex items-center justify-center gap-2">
                <button type="button" onClick={() => { setCodeMethod('otp'); setError(''); }} disabled={otpUnavailable}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] border ${codeMethod === 'otp' ? 'border-hc-teal/50 text-white bg-hc-teal/10' : 'border-white/10 text-hc-muted'} ${otpUnavailable ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  OTP
                </button>
                <button type="button" onClick={() => { setCodeMethod('totp'); setError(''); }}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] border ${codeMethod === 'totp' ? 'border-hc-teal/50 text-white bg-hc-teal/10' : 'border-white/10 text-hc-muted'}`}>
                  Authenticator
                </button>
                <button type="button" onClick={() => { setCodeMethod('recovery'); setError(''); }}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] border ${codeMethod === 'recovery' ? 'border-hc-teal/50 text-white bg-hc-teal/10' : 'border-white/10 text-hc-muted'}`}>
                  Emergency
                </button>
              </div>
              <div className="group">
                <label className="section-header text-[9px] mb-2 ml-1 block opacity-40">
                  {codeMethod === 'recovery' ? 'RECOVERY CODE' : '6-DIGIT CODE'}
                </label>
                <input type="text" value={code}
                  onChange={e => {
                    const next = codeMethod === 'recovery'
                      ? e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24)
                      : e.target.value.replace(/\D/g, '').slice(0, 6);
                    setCode(next);
                    setError('');
                  }}
                  placeholder={codeMethod === 'recovery' ? 'XXXX-XXXX-XXXX' : '000000'} autoFocus inputMode={codeMethod === 'recovery' ? 'text' : 'numeric'} maxLength={codeMethod === 'recovery' ? 24 : 6}
                  className="w-full bg-hc-dark/60 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-hc-teal/50 shadow-inner tracking-[0.5em] text-center text-2xl font-black" />
              </div>
              {error && <div className="text-flag-red text-[10px] font-black uppercase text-center animate-in shake duration-300">{error}</div>}
              <button type="submit" disabled={loading || (codeMethod === 'recovery' ? code.trim().length < 8 : code.length < 6)} className="btn-gradient py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50">
                {loading ? 'VERIFYING...' : 'Verify'}
              </button>
              <button type="button" onClick={() => { setStep('email'); setCode(''); setError(''); setCodeMethod('otp'); }} className="text-hc-muted text-[10px] font-black uppercase tracking-[0.2em] text-center hover:text-white transition-all">← Resend Code</button>
            </form>
          )}
        </div>
        
        <div className="text-center opacity-40">
          <p className="text-[9px] font-black text-hc-muted uppercase tracking-[0.3em]">Hazel Care Ltd</p>
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
import type { WeekSummary, Action, Incident, StaffMember } from './lib/types';
import { loadWeekData, saveWeekData, loadActions, saveActions, loadIncidents, saveIncidents } from './lib/storage';


export type Page = 'briefing' | 'dashboard' | 'upload' | 'templates' | 'actions' | 'incidents' | 'staff' | 'notes' | 'handover' | 'compliance' | 'reports' | 'risk' | 'client-docs' | 'client-diary' | 'agency';

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [page, setPage] = useState<Page>('briefing');
  const [staffMode, setStaffMode] = useState<Page | null>(null);
  const [staffLinkActive, setStaffLinkActive] = useState(false);
  const [sacVerified, setSacVerified] = useState(() => sessionStorage.getItem('hc-sac-verified') === '1');
  const [staffToken, setStaffToken] = useState<string | null>(null);
  const [staffToolId, setStaffToolId] = useState<string | null>(null);

  // Check for staff share link on load: #staff/notes?t=<signed_token>
  useEffect(() => {
    function checkHash() {
      const hash = window.location.hash;
      const match = hash.match(/^#staff\/(\w+)/);
      const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
      const token = urlParams.get('t');
      
      if (match && STAFF_PAGES[match[1]]) {
        setStaffMode(STAFF_PAGES[match[1]]);
        setStaffLinkActive(true);
        setStaffToolId(match[1]);
        
        if (token) {
          setStaffToken(token);
          sessionStorage.removeItem('hc-sac-verified');
          setSacVerified(false);
        } else {
          setStaffToken(null);
        }
      } else {
        setStaffMode(null);
        setStaffLinkActive(false);
        setStaffToken(null);
        setStaffToolId(null);
        sessionStorage.removeItem('hc-sac-verified');
        setSacVerified(false);
      }
    }
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  const generateStaffLink = useCallback(async (toolId: string) => {
    const res = await fetch('/api/issue-staff-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolId }),
    });
    if (!res.ok) throw new Error('Failed to create secure staff link');
    const data = await res.json();
    return { link: data.link as string, code: data.code as string };
  }, []);

  if (!authed) return <LoginGate onUnlock={() => setAuthed(true)} sacRequired={staffLinkActive && !sacVerified} staffToken={staffToken} staffToolId={staffToolId} />;

  // Staff standalone mode — minimal layout, just the tool
  if (staffLinkActive && staffMode) {
    return (
      <StaffStandaloneView 
        page={staffMode} 
        generateStaffLink={generateStaffLink} 
        onClose={() => { window.location.hash = ''; setStaffLinkActive(false); }} 
      />
    );
  }

  return <FullApp page={page} setPage={setPage} generateStaffLink={generateStaffLink} />;
}

function StaffStandaloneView({ page, onClose }: { page: Page; generateStaffLink: (id: string) => Promise<{ link: string; code: string }>; onClose: () => void }) {
  const [actions, setActions] = useState<Action[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    setActions(loadActions());
    setIncidents(loadIncidents());
  }, []);

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
            <img src="/logo-icon-dark.png" alt="Hazelcare" className="h-6 w-6 rounded-md" />
          </div>
          <div>
            <div className="text-base font-black text-white tracking-tighter uppercase text-shimmer">{TOOL_LABELS[page] || 'Staff Tool'}</div>
            <div className="text-[10px] font-black text-hc-teal-light uppercase tracking-widest">Hazel Care — Staff Access</div>
          </div>
        </div>
        <button onClick={onClose}
          className="group flex items-center gap-2.5 px-5 py-2.5 glass-light border border-white/10 text-hc-muted hover:text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all hover:bg-white/5 hover:border-hc-teal/30 shadow-xl">
          Exit Staff View
        </button>
      </div>

      {/* Tool content with responsive sizing fix */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 scrollbar-thin">
        <div className="max-w-6xl mx-auto">
          {page === 'notes' && <StaffNotePage />}
          {page === 'handover' && <HandoverPage />}
          {page === 'actions' && <ActionsPage actions={actions} onUpdate={(u) => { setActions(u); saveActions(u); }} />}
          {page === 'incidents' && <IncidentsPage incidents={incidents} onUpdate={(u) => { setIncidents(u); saveIncidents(u); }} />}
        </div>
      </div>
    </div>
  );
}

function FullApp({ page, setPage, generateStaffLink }: { page: Page; setPage: (p: Page) => void; generateStaffLink: (id: string) => Promise<{ link: string; code: string }> }) {
  const [weekData, setWeekData] = useState<WeekSummary | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [staff] = useState<StaffMember[]>([]);
  const [showShareModal, setShowShareModal] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadWeekData();
    const savedActions = loadActions();
    const savedIncidents = loadIncidents();
    if (saved) {
      setWeekData(saved);
      setActions(savedActions);
      setIncidents(savedIncidents);
    }
  }, []);

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

  async function copyStaffLink(toolId: string) {
    try {
      const { link, code } = await generateStaffLink(toolId);
      const payload = `Hazel Care staff access\nLink: ${link}\nSecure Access Code: ${code}`;
      await navigator.clipboard.writeText(payload);
      setShowShareModal(toolId);
      setTimeout(() => setShowShareModal(null), 2000);
    } catch {
      setShowShareModal('error');
      setTimeout(() => setShowShareModal(null), 2000);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-hc-darker">
      <Sidebar
        page={page}
        setPage={setPage}
        weekData={weekData}
        actions={actions}
        incidents={incidents}
      />
      <main className="flex-1 overflow-y-auto lg:h-full mesh-bg relative scrollbar-thin">
        {/* Staff share buttons on Staff Tools pages */}
        {(page === 'notes' || page === 'handover') && (
          <div className="px-8 pt-6 flex justify-end animate-in fade-in duration-1000">
            <button
              onClick={() => copyStaffLink(page)}
              className="group flex items-center gap-3 px-6 py-3 glass-light border border-white/10 text-hc-muted hover:text-hc-teal-light text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all hover:bg-white/5 hover:border-hc-teal/30 shadow-xl"
            >
              <svg className={`w-4 h-4 transition-transform ${showShareModal === page ? 'scale-125 text-flag-green' : 'group-hover:rotate-12'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              {showShareModal === page ? 'Link Copied' : 'Share Staff Link'}
            </button>
          </div>
        )}

        <div className="relative z-10 min-h-[calc(100vh-100px)]">
          {page === 'briefing' && <div className="animate-in fade-in slide-in-from-bottom-4 duration-700"><BriefingPage weekData={weekData} actions={actions} incidents={incidents} setPage={setPage} /></div>}
          {page === 'dashboard' && <div className="animate-in fade-in slide-in-from-bottom-4 duration-700"><Dashboard weekData={weekData} setPage={setPage} actions={actions} incidents={incidents} /></div>}
          {page === 'upload' && <div className="animate-in fade-in slide-in-from-bottom-4 duration-700"><UploadPage onDataParsed={handleDataParsed} setPage={setPage} /></div>}
          {page === 'templates' && <div className="animate-in fade-in slide-in-from-bottom-4 duration-700"><TemplatesPage weekData={weekData} /></div>}
          {page === 'actions' && <div className="animate-in fade-in slide-in-from-bottom-4 duration-700"><ActionsPage actions={actions} onUpdate={handleUpdateActions} /></div>}
          {page === 'incidents' && <div className="animate-in fade-in slide-in-from-bottom-4 duration-700"><IncidentsPage incidents={incidents} onUpdate={handleUpdateIncidents} /></div>}
          {page === 'staff' && <div className="animate-in fade-in slide-in-from-bottom-4 duration-700"><StaffPage staff={staff} /></div>}
          {page === 'notes' && <div className="animate-in fade-in slide-in-from-bottom-4 duration-700"><StaffNotePage /></div>}
          {page === 'handover' && <div className="animate-in fade-in slide-in-from-bottom-4 duration-700"><HandoverPage /></div>}
          {page === 'compliance' && <div className="animate-in fade-in slide-in-from-bottom-4 duration-700"><CompliancePage /></div>}
          {page === 'reports' && <div className="animate-in fade-in slide-in-from-bottom-4 duration-700"><ReportsPage weekData={weekData} setPage={setPage} /></div>}
          {page === 'risk' && <div className="animate-in fade-in slide-in-from-bottom-4 duration-700"><RiskScoresPage weekData={weekData} /></div>}
          {page === 'client-docs' && <div className="animate-in fade-in slide-in-from-bottom-4 duration-700"><ClientDocsPage /></div>}
          {page === 'client-diary' && <div className="animate-in fade-in slide-in-from-bottom-4 duration-700"><ClientDiaryPage weekData={weekData} setPage={setPage} /></div>}
          {page === 'agency' && <div className="animate-in fade-in slide-in-from-bottom-4 duration-700"><AgencyPortalPage /></div>}
        </div>
      </main>
    </div>
  );
}
