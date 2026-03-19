import { useState, useEffect, useCallback } from 'react';

const PASSWORD = 'hazelcare2026';

// Staff share link pages — these can be opened standalone via hash
const STAFF_PAGES: Record<string, Page> = {
  'notes': 'notes',
  'handover': 'handover',
  'actions': 'actions',
  'incidents': 'incidents',
};

function LoginGate({ onUnlock }: { onUnlock: () => void }) {
  const [step, setStep] = useState<'password' | 'email' | 'code'>('password');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password === PASSWORD) {
      setError('');
      setStep('email');
    } else {
      setError('Incorrect password');
      setPassword('');
    }
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
      setStep('code');
    } catch {
      setError('Could not send code. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, token })
      });
      const data = await res.json();
      if (data.valid) {
        sessionStorage.setItem('hc-auth', '1');
        onUnlock();
      } else {
        setError('Invalid or expired code');
        setCode('');
      }
    } catch {
      setError('Verification failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const warning = (
    <div className="bg-red-950/60 border border-red-500/50 rounded-lg px-4 py-3 text-center">
      <div className="text-red-400 text-xs font-bold uppercase tracking-wide mb-1">Restricted Access</div>
      <div className="text-red-300/80 text-[11px] leading-snug">This system is private, secured, and monitored. Unauthorised access is strictly prohibited and may be subject to legal action under the Computer Misuse Act 1990.</div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center mesh-bg relative overflow-hidden">
      {/* Ambient orbs */}
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-hc-teal/5 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-hc-blue/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />

      <div className="flex flex-col gap-4 w-full max-w-xs relative z-10">
        <div className="text-center mb-2">
          <div className="flex justify-center mb-3">
            <img src="/logo-icon-dark.png" alt="Hazelcare" className="h-12 w-12 rounded-xl glow-breathe" />
          </div>
          <div className="text-shimmer text-2xl font-bold tracking-tight">HazelCare Ops</div>
          <div className="text-slate-400 text-sm mt-1">
            {step === 'password' && 'Enter your access password'}
            {step === 'email' && 'Enter the email you were granted access with'}
            {step === 'code' && `Check your access code — it's been sent for approval`}
          </div>
        </div>

        {warning}

        {step === 'password' && (
          <form onSubmit={handlePassword} className="flex flex-col gap-3">
            <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Password" autoFocus
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-hc-teal/50 text-sm" />
            {error && <div className="text-red-400 text-xs text-center">{error}</div>}
            <button type="submit" className="btn-gradient py-3 rounded-lg text-sm">Continue</button>
          </form>
        )}

        {step === 'email' && (
          <form onSubmit={handleEmail} className="flex flex-col gap-3">
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
              placeholder="your@email.com" autoFocus
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-hc-teal/50 text-sm" />
            {error && <div className="text-red-400 text-xs text-center">{error}</div>}
            <button type="submit" disabled={loading} className="btn-gradient py-3 rounded-lg text-sm disabled:opacity-50">
              {loading ? 'Sending...' : 'Request Access Code'}
            </button>
            <button type="button" onClick={() => setStep('password')} className="text-slate-500 text-xs text-center hover:text-slate-300">← Back</button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleCode} className="flex flex-col gap-3">
            <div className="bg-hc-teal/10 border border-hc-teal/20 rounded-lg px-4 py-3 text-center">
              <div className="text-hc-teal-light text-xs">Code sent for approval. Once you receive it, enter it below.</div>
            </div>
            <input type="text" value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              placeholder="6-digit code" autoFocus inputMode="numeric" maxLength={6}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-hc-teal/50 text-sm tracking-widest text-center text-lg" />
            {error && <div className="text-red-400 text-xs text-center">{error}</div>}
            <button type="submit" disabled={loading || code.length < 6} className="btn-gradient py-3 rounded-lg text-sm disabled:opacity-50">
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
            <button type="button" onClick={() => { setStep('email'); setCode(''); setError(''); }} className="text-slate-500 text-xs text-center hover:text-slate-300">← Resend code</button>
          </form>
        )}
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
import { generateMockEntries, generateMockActions, generateMockIncidents, generateMockStaff } from './lib/mock-data';
import { buildWeekSummary } from './lib/nourish-parser';

export type Page = 'briefing' | 'dashboard' | 'upload' | 'templates' | 'actions' | 'incidents' | 'staff' | 'notes' | 'handover' | 'compliance' | 'reports' | 'risk' | 'client-docs' | 'client-diary' | 'agency';

export default function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('hc-auth') === '1');
  const [page, setPage] = useState<Page>('briefing');
  const [staffMode, setStaffMode] = useState<Page | null>(null);
  const [staffLinkActive, setStaffLinkActive] = useState(false);

  // Check for staff share link on load: #staff/notes, #staff/handover, etc.
  useEffect(() => {
    function checkHash() {
      const hash = window.location.hash;
      const match = hash.match(/^#staff\/(\w+)$/);
      if (match && STAFF_PAGES[match[1]]) {
        setStaffMode(STAFF_PAGES[match[1]]);
        setStaffLinkActive(true);
        // Auto-auth for staff link access
        sessionStorage.setItem('hc-auth', '1');
        setAuthed(true);
      } else {
        setStaffMode(null);
        setStaffLinkActive(false);
      }
    }
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  const generateStaffLink = useCallback((toolId: string) => {
    return `${window.location.origin}${window.location.pathname}#staff/${toolId}`;
  }, []);

  if (!authed) return <LoginGate onUnlock={() => setAuthed(true)} />;

  // Staff standalone mode — minimal layout, just the tool
  if (staffLinkActive && staffMode) {
    return <StaffStandaloneView page={staffMode} generateStaffLink={generateStaffLink} onClose={() => { window.location.hash = ''; setStaffLinkActive(false); }} />;
  }

  return <FullApp page={page} setPage={setPage} generateStaffLink={generateStaffLink} />;
}

function StaffStandaloneView({ page, generateStaffLink: _gen, onClose }: { page: Page; generateStaffLink: (id: string) => string; onClose: () => void }) {
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
    <div className="min-h-screen mesh-bg">
      {/* Minimal header */}
      <div className="border-b border-hc-border/50 px-4 py-3 flex items-center justify-between" style={{ background: 'linear-gradient(180deg, rgba(10, 16, 32, 0.95), rgba(6, 11, 20, 0.95))' }}>
        <div className="flex items-center gap-3">
          <img src="/logo-icon-dark.png" alt="Hazelcare" className="h-7 w-7 rounded-md" />
          <div>
            <div className="text-sm font-bold text-white">{TOOL_LABELS[page] || 'Staff Tool'}</div>
            <div className="text-[10px] text-hc-muted">HazelCare Ops — Staff Access</div>
          </div>
        </div>
        <button onClick={onClose} className="text-[11px] text-hc-muted hover:text-white px-3 py-1.5 rounded-lg border border-hc-border hover:border-hc-teal/30 transition-all">
          Exit Staff View
        </button>
      </div>

      {/* Tool content */}
      <div className="p-0">
        {page === 'notes' && <StaffNotePage />}
        {page === 'handover' && <HandoverPage />}
        {page === 'actions' && <ActionsPage actions={actions} onUpdate={(u) => { setActions(u); saveActions(u); }} />}
        {page === 'incidents' && <IncidentsPage incidents={incidents} onUpdate={(u) => { setIncidents(u); saveIncidents(u); }} />}
      </div>
    </div>
  );
}

function FullApp({ page, setPage, generateStaffLink }: { page: Page; setPage: (p: Page) => void; generateStaffLink: (id: string) => string }) {
  const [weekData, setWeekData] = useState<WeekSummary | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [showShareModal, setShowShareModal] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadWeekData();
    const savedActions = loadActions();
    const savedIncidents = loadIncidents();
    if (saved) {
      setWeekData(saved);
      setActions(savedActions);
      setIncidents(savedIncidents);
    } else {
      loadDemoData();
    }
  }, []);

  function loadDemoData() {
    const entries = generateMockEntries();
    const summary = buildWeekSummary(entries);
    setWeekData(summary);
    setActions(generateMockActions());
    setIncidents(generateMockIncidents());
    setStaff(generateMockStaff());
    setIsDemo(true);
  }

  function handleDataParsed(data: WeekSummary) {
    setWeekData(data);
    saveWeekData(data);
    setIsDemo(false);
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

  function copyStaffLink(toolId: string) {
    const link = generateStaffLink(toolId);
    navigator.clipboard.writeText(link).then(() => {
      setShowShareModal(toolId);
      setTimeout(() => setShowShareModal(null), 2000);
    });
  }

  return (
    <div className="flex min-h-screen bg-hc-darker">
      <Sidebar
        page={page}
        setPage={setPage}
        weekData={weekData}
        actions={actions}
        incidents={incidents}
        isDemo={isDemo}
        onLoadDemo={loadDemoData}
      />
      <main className="flex-1 overflow-y-auto pt-[52px] lg:pt-0 mesh-bg">
        {isDemo && (
          <div className="bg-hc-teal/10 border-b border-hc-teal/20 px-4 lg:px-6 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-hc-teal-light dot-pulse" />
              <span className="text-[11px] lg:text-xs text-hc-teal-light font-medium">Demo Mode — Sample data from 10 houses</span>
            </div>
            <button onClick={() => setPage('upload')} className="text-[11px] lg:text-xs text-hc-teal-light hover:text-white font-medium">Import real data</button>
          </div>
        )}

        {/* Staff share buttons on Staff Tools pages */}
        {(page === 'notes' || page === 'handover') && (
          <div className="px-4 lg:px-6 pt-3 flex justify-end">
            <button
              onClick={() => copyStaffLink(page)}
              className="flex items-center gap-1.5 text-[11px] text-hc-muted hover:text-hc-teal-light px-3 py-1.5 rounded-lg border border-hc-border hover:border-hc-teal/30 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              {showShareModal === page ? 'Copied!' : 'Share with Staff'}
            </button>
          </div>
        )}

        {page === 'briefing' && <BriefingPage weekData={weekData} actions={actions} incidents={incidents} setPage={setPage} />}
        {page === 'dashboard' && <Dashboard weekData={weekData} setPage={setPage} actions={actions} incidents={incidents} />}
        {page === 'upload' && <UploadPage onDataParsed={handleDataParsed} />}
        {page === 'templates' && <TemplatesPage weekData={weekData} />}
        {page === 'actions' && <ActionsPage actions={actions} onUpdate={handleUpdateActions} />}
        {page === 'incidents' && <IncidentsPage incidents={incidents} onUpdate={handleUpdateIncidents} />}
        {page === 'staff' && <StaffPage staff={staff} />}
        {page === 'notes' && <StaffNotePage />}
        {page === 'handover' && <HandoverPage />}
        {page === 'compliance' && <CompliancePage />}
        {page === 'reports' && <ReportsPage weekData={weekData} setPage={setPage} />}
        {page === 'risk' && <RiskScoresPage weekData={weekData} />}
        {page === 'client-docs' && <ClientDocsPage />}
        {page === 'client-diary' && <ClientDiaryPage weekData={weekData} setPage={setPage} />}
        {page === 'agency' && <AgencyPortalPage />}
      </main>
    </div>
  );
}
