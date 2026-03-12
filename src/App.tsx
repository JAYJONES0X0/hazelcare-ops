import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { UploadPage } from './pages/UploadPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { ActionsPage } from './pages/ActionsPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { StaffPage } from './pages/StaffPage';
import type { WeekSummary, Action, Incident, StaffMember } from './lib/types';
import { loadWeekData, saveWeekData, loadActions, saveActions, loadIncidents, saveIncidents } from './lib/storage';
import { generateMockEntries, generateMockActions, generateMockIncidents, generateMockStaff } from './lib/mock-data';
import { buildWeekSummary } from './lib/nourish-parser';

export type Page = 'dashboard' | 'upload' | 'templates' | 'actions' | 'incidents' | 'staff' | 'reports';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [weekData, setWeekData] = useState<WeekSummary | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isDemo, setIsDemo] = useState(false);

  // Load persisted data on mount
  useEffect(() => {
    const saved = loadWeekData();
    const savedActions = loadActions();
    const savedIncidents = loadIncidents();
    if (saved) {
      setWeekData(saved);
      setActions(savedActions);
      setIncidents(savedIncidents);
    } else {
      // Load demo data so the app looks alive
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
      <main className="flex-1 overflow-y-auto" style={{ background: 'linear-gradient(180deg, #080e1a 0%, #0c1525 100%)' }}>
        {/* Demo banner */}
        {isDemo && (
          <div className="bg-hc-teal/10 border-b border-hc-teal/20 px-6 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-hc-teal-light dot-pulse" />
              <span className="text-xs text-hc-teal-light font-medium">Demo Mode — Showing sample data from 10 houses</span>
            </div>
            <button
              onClick={() => setPage('upload')}
              className="text-xs text-hc-teal-light hover:text-white font-medium"
            >
              Import real data
            </button>
          </div>
        )}

        {page === 'dashboard' && <Dashboard weekData={weekData} setPage={setPage} actions={actions} incidents={incidents} />}
        {page === 'upload' && <UploadPage onDataParsed={handleDataParsed} />}
        {page === 'templates' && <TemplatesPage weekData={weekData} />}
        {page === 'actions' && <ActionsPage actions={actions} onUpdate={handleUpdateActions} />}
        {page === 'incidents' && <IncidentsPage incidents={incidents} onUpdate={handleUpdateIncidents} />}
        {page === 'staff' && <StaffPage staff={staff} />}
        {page === 'reports' && <Dashboard weekData={weekData} setPage={setPage} actions={actions} incidents={incidents} />}
      </main>
    </div>
  );
}
