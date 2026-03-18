import { useState, useEffect } from 'react';

const PASSWORD = 'hazelcare2026';

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
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #080e1a 0%, #0c1525 100%)' }}>
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <div className="text-center mb-2">
          <div className="text-hc-teal-light text-2xl font-bold tracking-tight">HazelCare Ops</div>
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
            <button type="submit" className="bg-hc-teal hover:bg-hc-teal-light text-white font-medium py-3 rounded-lg text-sm transition-colors">Continue</button>
          </form>
        )}

        {step === 'email' && (
          <form onSubmit={handleEmail} className="flex flex-col gap-3">
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
              placeholder="your@email.com" autoFocus
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-hc-teal/50 text-sm" />
            {error && <div className="text-red-400 text-xs text-center">{error}</div>}
            <button type="submit" disabled={loading} className="bg-hc-teal hover:bg-hc-teal-light text-white font-medium py-3 rounded-lg text-sm transition-colors disabled:opacity-50">
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
            <button type="submit" disabled={loading || code.length < 6} className="bg-hc-teal hover:bg-hc-teal-light text-white font-medium py-3 rounded-lg text-sm transition-colors disabled:opacity-50">
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

  if (!authed) return <LoginGate onUnlock={() => setAuthed(true)} />;
  const [weekData, setWeekData] = useState<WeekSummary | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isDemo, setIsDemo] = useState(false);

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
      <main className="flex-1 overflow-y-auto pt-[52px] lg:pt-0" style={{ background: 'linear-gradient(180deg, #080e1a 0%, #0c1525 100%)' }}>
        {isDemo && (
          <div className="bg-hc-teal/10 border-b border-hc-teal/20 px-4 lg:px-6 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-hc-teal-light dot-pulse" />
              <span className="text-[11px] lg:text-xs text-hc-teal-light font-medium">Demo Mode — Sample data from 10 houses</span>
            </div>
            <button onClick={() => setPage('upload')} className="text-[11px] lg:text-xs text-hc-teal-light hover:text-white font-medium">Import real data</button>
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
