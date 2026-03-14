import { useState, type ReactNode } from 'react';
import type { Page } from '../App';
import type { WeekSummary, Action, Incident } from '../lib/types';

interface Props {
  page: Page;
  setPage: (p: Page) => void;
  weekData: WeekSummary | null;
  actions: Action[];
  incidents: Incident[];
  isDemo: boolean;
  onLoadDemo: () => void;
}

const navSections: { heading?: string; items: { id: Page; label: string; icon: ReactNode }[] }[] = [
  {
    heading: 'Overview',
    items: [
      { id: 'briefing' as Page, label: 'Morning Briefing', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg> },
      { id: 'dashboard', label: 'Dashboard', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" /></svg> },
      { id: 'upload', label: 'Import Data', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> },
    ],
  },
  {
    heading: 'Operations',
    items: [
      { id: 'actions', label: 'Action Tracker', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> },
      { id: 'incidents', label: 'Incidents', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg> },
      { id: 'risk', label: 'Risk Scores', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
      { id: 'staff', label: 'Staff', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
    ],
  },
  {
    heading: 'Staff Tools',
    items: [
      { id: 'notes' as Page, label: 'Note Assistant', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
      { id: 'handover' as Page, label: 'Shift Handover', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg> },
    ],
  },
  {
    heading: 'Compliance',
    items: [
      { id: 'compliance' as Page, label: 'Compliance Hub', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> },
    ],
  },
  {
    heading: 'Output',
    items: [
      { id: 'templates', label: 'Templates', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
      { id: 'reports', label: 'Reports', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
    ],
  },
];

export function Sidebar({ page, setPage, weekData, actions, incidents, isDemo }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const redFlags = weekData?.allFlags.red.length ?? 0;
  const amberFlags = weekData?.allFlags.amber.length ?? 0;
  const openActions = actions.filter(a => a.status !== 'completed').length;
  const activeIncidents = incidents.filter(i => i.stage !== 'closed').length;

  function getBadge(id: Page): ReactNode | null {
    if (id === 'dashboard' && redFlags > 0) return <span className="ml-auto bg-flag-red text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{redFlags}</span>;
    if (id === 'actions' && openActions > 0) return <span className="ml-auto bg-hc-blue text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{openActions}</span>;
    if (id === 'incidents' && activeIncidents > 0) return <span className="ml-auto bg-flag-amber text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{activeIncidents}</span>;
    return null;
  }

  function handleNav(id: Page) {
    setPage(id);
    setMobileOpen(false);
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-4 lg:p-5 border-b border-hc-border">
        <div className="flex items-center gap-3">
          <img src="/logo-icon-dark.png" alt="Hazelcare" className="h-9 w-9 rounded-lg" />
          <div>
            <div className="text-[13px] font-bold text-white tracking-tight">Ops Engine</div>
            <div className="text-[10px] text-hc-muted font-medium">Hazelcare · Zero Cost</div>
          </div>
          {/* Mobile close */}
          <button onClick={() => setMobileOpen(false)} className="ml-auto lg:hidden text-hc-muted hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navSections.map((section, si) => (
          <div key={si}>
            {section.heading && (
              <div className="text-[10px] font-semibold text-hc-muted uppercase tracking-[0.1em] px-3 mb-2">{section.heading}</div>
            )}
            <div className="space-y-0.5">
              {section.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all ${
                    page === item.id ? 'bg-hc-teal/15 text-hc-teal-light font-semibold glow-teal' : 'text-hc-muted hover:text-white hover:bg-white/[0.03]'
                  }`}
                >
                  {item.icon}
                  {item.label}
                  {getBadge(item.id)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Status Panel */}
      <div className="p-3 border-t border-hc-border hidden lg:block">
        {weekData ? (
          <div className="bg-hc-card rounded-xl p-3.5 border border-hc-border">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] text-hc-muted uppercase tracking-wider font-semibold">This Week</div>
              {isDemo && <span className="text-[9px] text-hc-teal-light bg-hc-teal/20 px-1.5 py-0.5 rounded">DEMO</span>}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><div className="text-lg font-bold text-white">{weekData.totalEntries}</div><div className="text-[9px] text-hc-muted">Entries</div></div>
              <div><div className="text-lg font-bold text-flag-red">{redFlags}</div><div className="text-[9px] text-hc-muted">Red</div></div>
              <div><div className="text-lg font-bold text-flag-amber">{amberFlags}</div><div className="text-[9px] text-hc-muted">Amber</div></div>
            </div>
            <div className="mt-3 pt-3 border-t border-hc-border">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-hc-muted">{Object.keys(weekData.houses).length} houses</span>
                <span className="text-hc-muted">{weekData.clients.length} clients</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-hc-muted text-center py-3">No data loaded</div>
        )}
      </div>

      {/* Quick links */}
      <div className="px-3 pb-4 hidden lg:block">
        <div className="flex gap-2">
          <a href="https://hazelcare.nourishcare.com/user/login?destination=reporting/clientdiary" target="_blank" rel="noopener" className="flex-1 text-[10px] text-center py-1.5 text-hc-muted hover:text-hc-teal-light border border-hc-border rounded-lg hover:border-hc-teal/30 transition-all">Nourish</a>
          <a href="https://org.nourishcare.co.uk/hazel-care-ltd+nc-hazelcare#/" target="_blank" rel="noopener" className="flex-1 text-[10px] text-center py-1.5 text-hc-muted hover:text-hc-teal-light border border-hc-border rounded-lg hover:border-hc-teal/30 transition-all">Portal</a>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3 border-b border-hc-border" style={{ background: 'linear-gradient(180deg, #0a1020 0%, #060b14 100%)' }}>
        <button onClick={() => setMobileOpen(true)} className="text-hc-muted hover:text-white">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <img src="/logo-icon-dark.png" alt="Hazelcare" className="h-7 w-7 rounded-md" />
        <span className="text-sm font-bold text-white">Ops Engine</span>
        {redFlags > 0 && <span className="bg-flag-red text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{redFlags}</span>}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 flex flex-col" style={{ background: 'linear-gradient(180deg, #0a1020 0%, #060b14 100%)' }}>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-col shrink-0 border-r border-hc-border" style={{ background: 'linear-gradient(180deg, #0a1020 0%, #060b14 100%)' }}>
        {sidebarContent}
      </aside>
    </>
  );
}
