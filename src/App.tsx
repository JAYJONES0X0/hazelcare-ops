import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { UploadPage } from './pages/UploadPage';
import { TemplatesPage } from './pages/TemplatesPage';
import type { WeekSummary } from './lib/types';

export type Page = 'dashboard' | 'upload' | 'templates' | 'reports';

export default function App() {
  const [page, setPage] = useState<Page>('upload');
  const [weekData, setWeekData] = useState<WeekSummary | null>(null);

  return (
    <div className="flex min-h-screen">
      <Sidebar page={page} setPage={setPage} weekData={weekData} />
      <main className="flex-1 overflow-y-auto">
        {page === 'dashboard' && <Dashboard weekData={weekData} setPage={setPage} />}
        {page === 'upload' && <UploadPage onDataParsed={(d) => { setWeekData(d); setPage('dashboard'); }} />}
        {page === 'templates' && <TemplatesPage weekData={weekData} />}
        {page === 'reports' && <Dashboard weekData={weekData} setPage={setPage} />}
      </main>
    </div>
  );
}
