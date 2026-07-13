import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Sidebar } from './components/Sidebar';
import { GlobalInjest } from './components/GlobalInjest';
import { Upload, ArrowUp, ArrowDown, Menu } from 'lucide-react';
import { RadarLoader } from './components/NexusLoader';

import type { WeekSummary, Action, Incident, StaffMember, Page, PageContext } from './lib/types';
import { loadWeekData, loadActions, saveActions, loadIncidents, saveIncidents, loadStaff, saveStaff, uid } from './lib/storage';
import { loadClients, type FullClient } from './lib/client-store';
import { getAllEntriesAsync, appendEntriesAsync } from './lib/entry-store';
import { buildWeekSummary } from './lib/universal-parser';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StaffAccessGate } from './components/StaffAccessGate';
import { getSectionByPage, SECTION_ACCENT } from './lib/navigation';
import { canAccessPage, normalizeUserRole, type UserRole } from './lib/rbac';
import { isSkinTheme, normalizeTheme, normalizeBaseTheme, type AppTheme } from './lib/theme';
import { setAuditIdentity } from './lib/audit';
import {
  clearLocalPreviewAuth,
  enableLocalPreviewAuth,
  getLocalPreviewRole,
  hasLocalPreviewAuth,
  isJsonResponse,
  isMissingLocalApiResponse,
} from './lib/local-preview-auth';

const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const UploadPage = lazy(() => import('./pages/UploadPage').then(m => ({ default: m.UploadPage })));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage').then(m => ({ default: m.TemplatesPage })));
const ActionsPage = lazy(() => import('./pages/ActionsPage').then(m => ({ default: m.ActionsPage })));
const IncidentsPage = lazy(() => import('./pages/IncidentsPage').then(m => ({ default: m.IncidentsPage })));
const StaffPage = lazy(() => import('./pages/StaffPage').then(m => ({ default: m.StaffPage })));
const StaffNotePage = lazy(() => import('./pages/StaffNotePage').then(m => ({ default: m.StaffNotePage })));
const HandoverPage = lazy(() => import('./pages/HandoverPage').then(m => ({ default: m.HandoverPage })));
const CommunicationsPage = lazy(() => import('./pages/CommunicationsPage').then(m => ({ default: m.CommunicationsPage })));
const BriefingPage = lazy(() => import('./pages/BriefingPage').then(m => ({ default: m.BriefingPage })));
const CompliancePage = lazy(() => import('./pages/CompliancePage').then(m => ({ default: m.CompliancePage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const RiskScoresPage = lazy(() => import('./pages/RiskScoresPage').then(m => ({ default: m.RiskScoresPage })));
const ClientDocsPage = lazy(() => import('./pages/ClientDocsPage').then(m => ({ default: m.ClientDocsPage })));
const MedicationSafetyPage = lazy(() => import('./pages/MedicationSafetyPage').then(m => ({ default: m.MedicationSafetyPage })));
const ClientFinancePage = lazy(() => import('./pages/ClientFinancePage').then(m => ({ default: m.ClientFinancePage })));
const ClientDiaryPage = lazy(() => import('./pages/ClientDiaryPage').then(m => ({ default: m.ClientDiaryPage })));
const AgencyPortalPage = lazy(() => import('./pages/AgencyPortalPage').then(m => ({ default: m.AgencyPortalPage })));
const StaffMonitoringPage = lazy(() => import('./pages/StaffMonitoringPage').then(m => ({ default: m.StaffMonitoringPage })));
const NoteWorkspace = lazy(() => import('./pages/NoteWorkspace').then(m => ({ default: m.NoteWorkspace })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
const EmpireMatrix = lazy(() => import('./pages/EmpireMatrix').then(m => ({ default: m.EmpireMatrix })));
const SovereignTrainingHub = lazy(() => import('./pages/SovereignTrainingHub'));
const NourishTaskPack = lazy(() => import('./pages/NourishTaskPack').then(m => ({ default: m.NourishTaskPack })));

type QuickActionRequest = {
  type: 'action' | 'incident';
  content?: string;
  house?: string;
  client?: string;
  action?: Action;
};


export default function App() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    // Branding Migration: Clear old hc-org-* keys if they contain old branding
    // This forces the new copper logo defaults for existing users.
    const oldLogo = localStorage.getItem('hc-org-logo');
    const oldName = localStorage.getItem('hc-org-name');
    if (oldLogo || oldName) {
      // If we see the old name or a logo override, clear it once.
      // We can be more surgical, but clearing once is safest for the rebranding.
      localStorage.removeItem('hc-org-logo');
      localStorage.removeItem('hc-org-name');
      window.dispatchEvent(new CustomEvent('hc-brand-updated'));
    }
  }, []);

  const [authed, setAuthed] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>(() => normalizeUserRole(localStorage.getItem('hc-user-role')));
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [pageId, setPageId] = useState<Page>(() => {
    const validPages: readonly Page[] = ['briefing','dashboard','communications','upload','templates','actions','incidents','staff','staff-tools','notes','note-workspace','training-hub','handover','compliance','reports','risk','client-docs','client-diary','agency','staff-monitoring','settings','admin','empire-matrix','nourish-tasks','client-finance','medication-safety'];
    const pathMatch = window.location.pathname.match(/\/(\w[\w-]*)$/);
    const fromPath = pathMatch && validPages.includes(pathMatch[1] as Page) ? pathMatch[1] as Page : null;
    const saved = fromPath || (localStorage.getItem('hc_current_page') as Page) || 'briefing';
    const role = normalizeUserRole(localStorage.getItem('hc-user-role'));
    return canAccessPage(role, saved) ? saved : 'briefing';
  });
  const [pageCtx, setPageCtx] = useState<PageContext | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  const [hasStaffHash] = useState(() => window.location.hash.startsWith('#staff/'));

  if (hasStaffHash) return <StaffAccessGate />;

  // Clean up URL path after reading deep-link
  useEffect(() => {
    const path = window.location.pathname;
    if (path !== '/' && path !== '/index.html') {
      window.history.replaceState(null, '', '/');
    }
  }, []);

  const setPage = useCallback((p: Page, ctx?: PageContext) => {
    if (!canAccessPage(userRole, p)) {
      setPageId('briefing');
      setPageCtx(null);
      localStorage.setItem('hc_current_page', 'briefing');
      return;
    }
    setPageId(p);
    setPageCtx(ctx || null);
    localStorage.setItem('hc_current_page', p);
  }, [userRole]);

  const page = canAccessPage(userRole, pageId) ? pageId : 'briefing';
  const activePageCtx = page === pageId ? pageCtx : null;

  useEffect(() => {
    if (page !== pageId) {
      localStorage.setItem('hc_current_page', page);
    }
  }, [page, pageId]);

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [pageId]);

  const scrollToTop = () => {
    const clinicalList = document.getElementById('clinical-workspace-list');
    if (clinicalList) {
      clinicalList.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToBottom = () => {
    const clinicalList = document.getElementById('clinical-workspace-list');
    if (clinicalList) {
      clinicalList.scrollTo({ top: clinicalList.scrollHeight, behavior: 'smooth' });
    } else if (mainRef.current) {
      mainRef.current.scrollTo({ top: mainRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  const activeSection = getSectionByPage(page);
  const [theme, setTheme] = useState<AppTheme>(() => {
    return normalizeTheme(localStorage.getItem('hc-theme'));
  });
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    return normalizeBaseTheme(localStorage.getItem('hc-mode') || localStorage.getItem('hc-base-theme'));
  });
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [globalInjestFile, setGlobalInjestFile] = useState<File | null>(null);
  const [buildTag] = useState(() => {
    const script = document.querySelector('script[type="module"][src*="assets/index-"]') as HTMLScriptElement | null;
    if (!script?.src) return 'unknown';
    const match = script.src.match(/assets\/(index-[^./]+)\.js/i);
    return match?.[1] || 'unknown';
  });

  useEffect(() => {
    // data-theme carries the skin (or the neutral light/dark value when no skin is active);
    // data-mode always carries light/dark independently so a skin can render in either mode.
    document.documentElement.setAttribute('data-theme', isSkinTheme(theme) ? theme : mode);
    document.documentElement.setAttribute('data-mode', mode);
    localStorage.setItem('hc-theme', theme);
    localStorage.setItem('hc-mode', mode);
    localStorage.setItem('hc-base-theme', mode);

    // Apply UI persistent settings
    const isCompact = localStorage.getItem('hc-compact-density') === 'true';
    const shadowDepth = Number(localStorage.getItem('hc-shadow-depth')) || 3;
    document.documentElement.classList.toggle('compact-density', isCompact);
    document.documentElement.style.setProperty('--shadow-depth', String(shadowDepth / 3));
  }, [theme, mode]);

  const [weekData, setWeekData] = useState<WeekSummary | null>(() => loadWeekData());
  const [actions, setActions] = useState<Action[]>(() => loadActions());
  const [incidents, setIncidents] = useState<Incident[]>(() => loadIncidents());
  const [staff, setStaff] = useState<StaffMember[]>(() => loadStaff());
  const [clients, setClients] = useState<FullClient[]>(() => loadClients());

  useEffect(() => {
    const refreshClients = () => setClients(loadClients());
    refreshClients();
    window.addEventListener('hc-clients-updated', refreshClients);
    window.addEventListener('storage', refreshClients);
    return () => {
      window.removeEventListener('hc-clients-updated', refreshClients);
      window.removeEventListener('storage', refreshClients);
    };
  }, []);

  useEffect(() => {
    setClients(loadClients());
  }, [page]);

  useEffect(() => {
    // Avoid full-history rebuild on startup when session week data already exists.
    // This prevents first-load stalls on large IndexedDB datasets.
    if (weekData) return;
    getAllEntriesAsync().then(entries => {
      if (entries && entries.length > 0) {
        const generated = buildWeekSummary(entries);
        setWeekData(generated);
      }
    }).catch(err => console.error('[Pipeline] Core Hydration Failure:', err));
  }, [weekData]);

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
  }, [handleWeekDataUpdate, setPage]);

  const handleQuickAction = useCallback((opts: QuickActionRequest) => {
    if (opts.type !== 'action') return;
    const evidenceId = `ev-quick-${uid()}`;
    const actionId = `action-${uid()}`;
    const action: Action = opts.action || {
      id: actionId,
      title: opts.client ? `Follow up ${opts.client}` : 'Follow up operational evidence',
      description: opts.content || 'Review source evidence and decide next action.',
      house: opts.house || 'General',
      resident: opts.client,
      owner: 'Manager review required',
      priority: 'medium',
      status: 'open',
      operationalState: 'not_started',
      createdAt: new Date().toISOString(),
      dueDate: '',
      sourceEvidence: opts.content ? [{
        id: evidenceId,
        sourceType: 'manual_note',
        sourceId: `quick-${actionId}`,
        title: opts.client ? `${opts.client} quick action source` : 'Quick action source',
        resident: opts.client,
        house: opts.house,
        excerpt: opts.content,
        confidence: 0.6,
        reviewState: 'review_required',
        usedForOutput: false,
      }] : [],
      stateHistory: [{
        id: `state-${uid()}`,
        actionId,
        to: 'not_started',
        at: new Date().toISOString(),
        by: 'Current User',
        reason: 'Created from operational evidence.',
        evidenceIds: opts.content ? [evidenceId] : [],
      }],
      carryForward: true,
      tags: ['quick-action', 'evidence-linked'],
    };
    setActions(current => {
      if (current.some(item => item.id === action.id)) return current;
      const next = [action, ...current];
      saveActions(next);
      return next;
    });
    setPage('actions');
  }, [setPage]);

  const handleGlobalDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setGlobalInjestFile(file);
  }, [setGlobalInjestFile, setIsDraggingFile]);

  const unlockLocalPreview = useCallback(() => {
    const role = getLocalPreviewRole();
    localStorage.setItem('hc-user-role', role);
    setUserRole(role);
    setAuthed(true);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
      if (hasLocalPreviewAuth()) {
        unlockLocalPreview();
      }
      setSessionLoaded(true);
    }, 8000);

    fetch('/api/auth/session', { credentials: 'include', signal: controller.signal })
      .then(async (r) => {
        if (isMissingLocalApiResponse(r)) {
          if (hasLocalPreviewAuth()) {
            unlockLocalPreview();
          }
          return null;
        }
        if (!isJsonResponse(r)) return null;
        return r.json();
      })
      .then((d) => {
        if (d?.authed) {
          setAuthed(true);
          const role = normalizeUserRole(d?.role || localStorage.getItem('hc-user-role'));
          localStorage.setItem('hc-user-role', role);
          setUserRole(role);
          setAuditIdentity(d?.email || role);
        }
        setSessionLoaded(true);
      })
      .catch(() => {
        if (hasLocalPreviewAuth()) {
          unlockLocalPreview();
        }
        setSessionLoaded(true);
      })
      .finally(() => window.clearTimeout(timeoutId));

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [unlockLocalPreview]);

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
    clearLocalPreviewAuth();
    await fetch('/api/auth/session', { method: 'DELETE', credentials: 'include' }).catch(() => null);
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
      <div className="min-h-dvh flex items-center justify-center bg-hc-bg safe-area">
        <RadarLoader color="#2dd4bf" size={48} />
      </div>
    );
  }

  if (!authed) {
    return <LoginGate onUnlock={(role) => {
      const normalized = normalizeUserRole(role);
      localStorage.setItem('hc-user-role', normalized);
      setUserRole(normalized);
      setAuthed(true);
    }} />;
  }

  return (
      <div
        className="relative min-h-dvh bg-hc-bg"
        onDragOver={e => { e.preventDefault(); setIsDraggingFile(true); }}
        onDragLeave={() => setIsDraggingFile(false)}
        onDrop={handleGlobalDrop}
      >
        <Analytics />
        <ErrorBoundary>
          <div className="flex h-dvh overflow-hidden">
          {mobileNavOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden="true"
            />
          )}
          <Sidebar page={page} setPage={setPage} weekData={weekData} theme={theme} setTheme={setTheme} mode={mode} setMode={setMode} onSignOut={handleSignOut} mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />

          <main ref={mainRef} className="flex-1 overflow-y-auto bg-hc-bg relative scrollbar-thin">
            <div className="relative z-10 w-full">
              <div className="sticky top-0 z-20 bg-hc-bg border-b border-hc-border/10">
                <div className="h-[2px] w-full" style={{ background: `linear-gradient(to right, ${SECTION_ACCENT[activeSection.id]}, transparent)` }} />
                <div className="flex items-center gap-1 px-1 sm:px-3 py-1.5 sm:py-2">
                  <button
                    onClick={() => setMobileNavOpen(true)}
                    aria-label="Open navigation"
                    className="md:hidden shrink-0 w-11 h-11 rounded-xl hc-clay-raised flex items-center justify-center text-hc-muted hover:text-hc-teal active:hc-clay-pressed"
                  >
                    <Menu size={20} />
                  </button>
                  <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1">
                  {activeSection.tabs.filter(tab => canAccessPage(userRole, tab.id)).map(tab => {
                    const active = page === tab.id;
                    const accent = SECTION_ACCENT[activeSection.id];
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setPage(tab.id)}
                        style={active ? { color: accent, borderColor: `${accent}33` } : undefined}
                        className={`shrink-0 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all border ${
                          active
                            ? 'hc-clay-pressed border-transparent'
                            : 'hc-clay-raised text-hc-muted hover:text-hc-text border-transparent'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                  </div>
                  {buildTag !== 'unknown' && (
                    <span className="hidden sm:inline shrink-0 px-2.5 py-1 rounded-lg hc-clay-inset text-[9px] font-black uppercase tracking-widest text-hc-muted border border-hc-border/20">
                      {buildTag}
                    </span>
                  )}
                  <span className="shrink-0 px-2 py-0.5 rounded-lg bg-hc-teal/10 text-[7px] sm:text-[9px] font-black uppercase tracking-widest text-hc-teal border border-hc-teal/20">
                    v2
                  </span>
                </div>
              </div>
              <Suspense fallback={
                <div className="px-4 sm:px-6 py-10">
                  <RadarLoader color="#2dd4bf" size={32} />
                </div>
              }>
                {page === 'briefing' && <BriefingPage weekData={weekData} actions={actions} setPage={setPage} />}
                {page === 'dashboard' && <Dashboard weekData={weekData} setPage={setPage} actions={actions} incidents={incidents} />}
                {page === 'communications' && <CommunicationsPage />}
                {page === 'upload' && <UploadPage onDataParsed={handleDataParsed} setPage={setPage} />}
                {page === 'templates' && <TemplatesPage weekData={weekData} />}
                {page === 'actions' && <ActionsPage actions={actions} onUpdate={(u) => { setActions(u); saveActions(u); }} />}
                {page === 'incidents' && <IncidentsPage incidents={incidents} onUpdate={(u) => { setIncidents(u); saveIncidents(u); }} />}
                {page === 'staff' && <StaffPage staff={staff} onUpdate={(u) => { setStaff(u); saveStaff(u); }} />}
                {(page === 'staff-tools' || page === 'notes') && <StaffNotePage setPage={setPage} />}
                {page === 'note-workspace' && <NoteWorkspace />}
                {page === 'training-hub' && <SovereignTrainingHub />}
                {page === 'handover' && <HandoverPage weekData={weekData} />}
                {page === 'compliance' && <CompliancePage staff={staff} onUpdate={(u) => { setStaff(u); saveStaff(u); }} />}
                {page === 'reports' && <ReportsPage weekData={weekData} setPage={setPage} />}
                {page === 'risk' && <RiskScoresPage weekData={weekData} onQuickAction={handleQuickAction} />}
                {page === 'client-docs' && <ClientDocsPage setPage={setPage} />}
                {page === 'medication-safety' && <MedicationSafetyPage />}
                {page === 'client-finance' && <ClientFinancePage />}
                {page === 'client-diary' && <ClientDiaryPage weekData={weekData} setPage={setPage} pageCtx={activePageCtx} onQuickAction={handleQuickAction} />}
                {page === 'agency' && <AgencyPortalPage />}
                {page === 'staff-monitoring' && <StaffMonitoringPage weekData={weekData} onDataParsed={handleWeekDataUpdate} setPage={setPage} />}
                {page === 'settings' && canAccessPage(userRole, 'settings') && <SettingsPage onSignOut={handleSignOut} setPage={setPage} />}
                {page === 'admin' && canAccessPage(userRole, 'admin') && <AdminPage weekData={weekData} clients={clients} />}
                {page === 'empire-matrix' && <EmpireMatrix weekData={weekData} setPage={setPage} />}
                {page === 'nourish-tasks' && <NourishTaskPack />}
              </Suspense>
            </div>

            {/* Floating Navigation Hub */}
            <div className="hidden md:flex fixed bottom-6 right-4 z-[100] flex-col gap-1.5 opacity-50 hover:opacity-100 transition-opacity">
              <button
                onClick={scrollToTop}
                title="Scroll to Top"
                className="p-2 hc-clay-raised rounded-xl text-hc-teal hover:scale-110 active:scale-95 transition-all group shadow-md bg-hc-surface/80 backdrop-blur-md"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={scrollToBottom}
                title="Scroll to Bottom"
                className="p-2 hc-clay-raised rounded-xl text-hc-teal hover:scale-110 active:scale-95 transition-all group shadow-md bg-hc-surface/80 backdrop-blur-md"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
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
                 <div className="text-xl font-black text-hc-text uppercase tracking-[0.4em]">Import Care Records</div>
              </div>
           </div>
        </div>
      )}

      {globalInjestFile && (
        <GlobalInjest
          file={globalInjestFile}
          onClose={() => setGlobalInjestFile(null)}
          onDataParsed={handleDataParsed}
        />
      )}
    </div>
  );
}

function LoginGate({ onUnlock }: { onUnlock: (role?: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });
    if (isMissingLocalApiResponse(res)) {
      if (!email.trim() || !password.trim()) {
        setError('Enter any local preview credentials');
        return;
      }
      enableLocalPreviewAuth('admin');
      onUnlock('admin');
      return;
    }
    const payload = isJsonResponse(res) ? await res.json().catch(() => ({})) : {};
    if (res.ok) {
      const role = normalizeUserRole(payload?.role || localStorage.getItem('hc-user-role'));
      localStorage.setItem('hc-user-role', role);
      onUnlock(role);
    }
    else setError(payload?.error || 'Invalid credentials');
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-hc-bg p-6">
      <form onSubmit={handleLogin} className="w-full max-w-sm hc-clay-raised p-10 space-y-8 rounded-[3rem] shadow-2xl border border-hc-muted/5">
        <div>
          <h1 className="text-2xl font-black text-hc-text uppercase tracking-tighter">Care Ops Access</h1>
          <p className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] mt-2">Enter credentials to open the care operations hub</p>
        </div>
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-[9px] font-black text-hc-muted uppercase tracking-widest">Email</span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="username"
              className="w-full hc-clay-inset px-6 py-4 text-sm font-black text-hc-text shadow-inner focus:outline-none focus:ring-2 focus:ring-hc-teal/40"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[9px] font-black text-hc-muted uppercase tracking-widest">Access Key</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Access Key"
              autoComplete="current-password"
              className="w-full hc-clay-inset px-6 py-4 text-sm font-black text-hc-text shadow-inner focus:outline-none focus:ring-2 focus:ring-hc-teal/40"
            />
          </label>
        </div>
        {error && <div className="text-[10px] font-black text-flag-red uppercase tracking-widest text-center">{error}</div>}
        <button type="submit" className="w-full py-5 btn-tactical text-hc-bg rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-xl active:scale-95 transition-all hover:scale-[1.02]">Open Operations Hub</button>
      </form>
    </div>
  );
}




