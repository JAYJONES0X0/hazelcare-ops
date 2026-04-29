import { useState, useEffect, useCallback, Component, type ReactNode, type ErrorInfo } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { UploadPage } from './pages/UploadPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { ActionsPage } from './pages/ActionsPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { StaffPage } from './pages/StaffPage';
import { StaffNotePage } from './pages/StaffNotePage';
import { HandoverPage } from './pages/HandoverPage';
import { CommunicationsPage } from './pages/CommunicationsPage';
import { BriefingPage } from './pages/BriefingPage';
import { CompliancePage } from './pages/CompliancePage';
import { ReportsPage } from './pages/ReportsPage';
import { RiskScoresPage } from './pages/RiskScoresPage';
import { ClientDocsPage } from './pages/ClientDocsPage';
import { ClientDiaryPage } from './pages/ClientDiaryPage';
import { AgencyPortalPage } from './pages/AgencyPortalPage';
import { StaffMonitoringPage } from './pages/StaffMonitoringPage';
import { NoteWorkspace } from './pages/NoteWorkspace';
import { SettingsPage } from './pages/SettingsPage';
import { AdminPage } from './pages/AdminPage';
import { EmpireMatrix } from './pages/EmpireMatrix';
import { GlobalInjest } from './components/GlobalInjest';
import { Upload } from 'lucide-react';

import type { WeekSummary, Action, Incident, StaffMember, Page } from './lib/types';
import { loadWeekData, loadActions, saveActions, loadIncidents, saveIncidents, loadStaff, saveStaff } from './lib/storage';
import { loadClients, type FullClient } from './lib/client-store';
import { getAllEntriesAsync, appendEntriesAsync } from './lib/entry-store';
import { buildWeekSummary } from './lib/universal-parser';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e?.message || String(e) }; }
  componentDidCatch(e: Error, info: ErrorInfo) { console.error('[ErrorBoundary]', e, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-hc-bg gap-4 text-hc-text font-black">
          <div className="text-flag-red text-lg uppercase tracking-tighter">App Cluster Failure</div>
          <pre className="text-hc-muted text-[10px] bg-black/40 p-6 rounded-3xl max-w-2xl overflow-auto border border-white/5 font-mono">{this.state.error}</pre>
          <button onClick={() => this.setState({ error: null })} className="hc-clay-raised px-8 py-3 rounded-xl text-xs uppercase tracking-widest">Reset Core</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [pageId, setPageId] = useState<Page>('briefing');
  const [pageCtx, setPageCtx] = useState<any>(null);

  const setPage = useCallback((p: Page, ctx?: any) => {
    setPageId(p);
    setPageCtx(ctx || null);
  }, []);

  const page = pageId;
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('hc-theme') as 'dark' | 'light') || 'dark');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [globalInjestFile, setGlobalInjestFile] = useState<File | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('hc-theme', theme);
    
    // Apply UI persistent settings
    const isCompact = localStorage.getItem('hc-compact-density') === 'true';
    const shadowDepth = Number(localStorage.getItem('hc-shadow-depth')) || 3;
    document.documentElement.classList.toggle('compact-density', isCompact);
    document.documentElement.style.setProperty('--shadow-depth', String(shadowDepth / 3));
  }, [theme]);

  const [weekData, setWeekData] = useState<WeekSummary | null>(() => loadWeekData());
  const [actions, setActions] = useState<Action[]>(() => loadActions());
  const [incidents, setIncidents] = useState<Incident[]>(() => loadIncidents());
  const [staff, setStaff] = useState<StaffMember[]>(() => loadStaff());
  const [clients] = useState<FullClient[]>(() => loadClients());

  useEffect(() => {
    // ── MILITARY GRADE HYDRATION: Connect Offline Dashboards to Unlimited IndexedDB
    getAllEntriesAsync().then(entries => {
      if (entries && entries.length > 0) {
        const generated = buildWeekSummary(entries);
        setWeekData(generated);
      }
    }).catch(err => console.error('[Pipeline] Core Hydration Failure:', err));
  }, []);

  const handleWeekDataUpdate = useCallback(async (data: WeekSummary) => {
    const newEntries = Object.values(data.houses).flatMap(h => h.entries);
    if (newEntries.length > 0) {
      await appendEntriesAsync(newEntries);
      const fullHistory = await getAllEntriesAsync();
      const generated = buildWeekSummary(fullHistory);
      setWeekData(generated);
    } else {
      setWeekData(data);
    }
  }, []);

  const handleDataParsed = useCallback(async (data: WeekSummary) => {
    await handleWeekDataUpdate(data);
    setPage('dashboard');
  }, [handleWeekDataUpdate]);

  const handleGlobalDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setGlobalInjestFile(file);
  }, []);

  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.authed) setAuthed(true);
        setSessionLoaded(true);
      })
      .catch(() => setSessionLoaded(true));
  }, []);

  const handleSignOut = async () => {
    // Remove this session from the registry before signing out
    const sessionId = sessionStorage.getItem('hc-session-id');
    if (sessionId) {
      const raw = localStorage.getItem('hc-registered-sessions');
      if (raw) {
        const sessions = JSON.parse(raw).filter((s: { id: string }) => s.id !== sessionId);
        localStorage.setItem('hc-registered-sessions', JSON.stringify(sessions));
      }
    }
    sessionStorage.removeItem('hc-pin-unlocked');
    await fetch('/api/auth/session', { method: 'DELETE', credentials: 'include' });
    window.location.reload();
  };

  // Register/refresh session record when authenticated
  useEffect(() => {
    if (!authed) return;

    let sessionId = sessionStorage.getItem('hc-session-id');
    if (!sessionId) {
      sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      sessionStorage.setItem('hc-session-id', sessionId);
    }

    const raw = localStorage.getItem('hc-registered-sessions');
    const sessions: { id: string; device: string; browser: string; timestamp: string; lastActive: string; revoked: boolean }[] = raw ? JSON.parse(raw) : [];

    // If another device revoked this session, sign out
    const thisEntry = sessions.find(s => s.id === sessionId);
    if (thisEntry?.revoked) {
      handleSignOut();
      return;
    }

    const ua = navigator.userAgent;
    const device = /Mobile|Android|iPhone|iPad/.test(ua) ? 'Mobile' : 'Desktop';
    const browser = /Edg/.test(ua) ? 'Edge' : /Firefox/.test(ua) ? 'Firefox' : /Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Browser';
    const now = new Date().toISOString();

    const others = sessions.filter(s => s.id !== sessionId);
    others.push({ id: sessionId, device, browser, timestamp: thisEntry?.timestamp || now, lastActive: now, revoked: false });
    localStorage.setItem('hc-registered-sessions', JSON.stringify(others.slice(-20)));
  }, [authed]); 
  if (!sessionLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hc-bg">
        <div className="w-12 h-12 rounded-full border-4 border-hc-teal/20 border-t-hc-teal animate-spin" />
      </div>
    );
  }

  if (!authed) {
    return <LoginGate onUnlock={() => setAuthed(true)} />;
  }

  return (
    <div
      className="relative min-h-screen bg-hc-bg"
      onDragOver={e => { e.preventDefault(); setIsDraggingFile(true); }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={handleGlobalDrop}
    >
      <ErrorBoundary>
        <div className="flex h-screen overflow-hidden">
          <Sidebar page={page} setPage={setPage} weekData={weekData} actions={actions} theme={theme} setTheme={setTheme} onSignOut={handleSignOut} />

          <main className="flex-1 overflow-y-auto bg-hc-bg relative scrollbar-thin">
            <div className="relative z-10 w-full min-h-screen">
              {page === 'briefing' && <BriefingPage weekData={weekData} actions={actions} setPage={setPage} />}
              {page === 'dashboard' && <Dashboard weekData={weekData} setPage={setPage} actions={actions} incidents={incidents} />}
              {page === 'communications' && <CommunicationsPage />}
              {page === 'upload' && <UploadPage onDataParsed={handleDataParsed} setPage={setPage} />}
              {page === 'templates' && <TemplatesPage weekData={weekData} />}
              {page === 'actions' && <ActionsPage actions={actions} onUpdate={(u) => { setActions(u); saveActions(u); }} />}
              {page === 'incidents' && <IncidentsPage incidents={incidents} onUpdate={(u) => { setIncidents(u); saveIncidents(u); }} />}
              {page === 'staff' && <StaffPage staff={staff} onUpdate={(u) => { setStaff(u); saveStaff(u); }} />}
              {page === 'notes' && <StaffNotePage />}
              {page === 'note-workspace' && <NoteWorkspace />}
              {page === 'handover' && <HandoverPage weekData={weekData} />}
              {page === 'compliance' && <CompliancePage staff={staff} onUpdate={(u) => { setStaff(u); saveStaff(u); }} />}
              {page === 'reports' && <ReportsPage weekData={weekData} setPage={setPage} />}
              {page === 'risk' && <RiskScoresPage weekData={weekData} onQuickAction={() => {}} />}
              {page === 'client-docs' && <ClientDocsPage />}
              {page === 'client-diary' && <ClientDiaryPage weekData={weekData} setPage={setPage} pageCtx={pageCtx} onQuickAction={() => {}} />}
              {page === 'agency' && <AgencyPortalPage />}
              {page === 'staff-monitoring' && <StaffMonitoringPage weekData={weekData} onDataParsed={handleWeekDataUpdate} />}
              {page === 'settings' && <SettingsPage onSignOut={handleSignOut} setPage={setPage} />}
              {page === 'admin' && <AdminPage weekData={weekData} clients={clients} />}
              {page === 'empire-matrix' && <EmpireMatrix weekData={weekData} />}
            </div>
          </main>
        </div>
      </ErrorBoundary>

      {isDraggingFile && (
        <div className="fixed inset-0 z-[200] pointer-events-none animate-in fade-in duration-300">
           <div className="absolute inset-0 bg-hc-teal/10 backdrop-blur-sm border-[8px] border-dashed border-hc-teal/40 m-8 rounded-[4rem]" />
           <div className="absolute inset-0 flex items-center justify-center">
              <div className="hc-clay-raised p-12 flex flex-col items-center gap-6 animate-bounce shadow-2xl border border-hc-teal/5">
                 <Upload className="w-16 h-16 text-hc-teal" />
                 <div className="text-xl font-black text-hc-text uppercase tracking-[0.4em]">Injest Clinical Stream</div>
              </div>
           </div>
        </div>
      )}

      {globalInjestFile && (
        <GlobalInjest
          file={globalInjestFile}
          onClose={() => setGlobalInjestFile(null)}
          onDataParsed={handleDataParsed}
          setPage={setPage}
        />
      )}
    </div>
  );
}

function LoginGate({ onUnlock }: { onUnlock: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });
    if (res.ok) onUnlock();
    else setError('Invalid credentials');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-hc-bg p-6">
      <form onSubmit={handleLogin} className="w-full max-w-sm hc-clay-raised p-10 space-y-8 rounded-[3rem] shadow-2xl border border-hc-muted/5">
        <div>
          <h1 className="text-2xl font-black text-hc-text uppercase tracking-tighter">Sovereign Access</h1>
          <p className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] mt-2">Enter credentials to initialize bridge</p>
        </div>
        <div className="space-y-4">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Personnel ID" className="w-full hc-clay-inset px-6 py-4 text-sm font-black text-hc-text outline-none shadow-inner" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Access Key" className="w-full hc-clay-inset px-6 py-4 text-sm font-black text-hc-text outline-none shadow-inner" />
        </div>
        {error && <div className="text-[10px] font-black text-flag-red uppercase tracking-widest text-center">{error}</div>}
        <button type="submit" className="w-full py-5 btn-tactical text-hc-bg rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-xl active:scale-95 transition-all hover:scale-[1.02]">Establish Connection</button>
      </form>
    </div>
  );
}
