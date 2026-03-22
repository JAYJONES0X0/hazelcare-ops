import { useState, type ReactNode } from 'react';
import type { Page } from '../App';
import type { WeekSummary, Action, Incident } from '../lib/types';

interface Props {
  page: Page;
  setPage: (p: Page) => void;
  weekData: WeekSummary | null;
  actions: Action[];
  incidents: Incident[];
}

const navSections: { heading?: string; items: { id: Page; label: string; icon: ReactNode }[] }[] = [
  {
    heading: 'Overview',
    items: [
      { id: 'briefing' as Page, label: 'Morning Briefing', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg> },
      { id: 'dashboard', label: 'Service Hub', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" /></svg> },
      { id: 'upload', label: 'Sync Data', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> },
    ],
  },
  {
    heading: 'Operations',
    items: [
      { id: 'client-diary' as Page, label: 'Client Diary', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg> },
      { id: 'actions', label: 'Action Tracker', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> },
      { id: 'incidents', label: 'Incidents', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg> },
      { id: 'risk', label: 'Risk Scores', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
      { id: 'staff', label: 'Staff Roster', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
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
    heading: 'Workforce',
    items: [
      { id: 'agency' as Page, label: 'Agency Portal', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
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
      { id: 'client-docs' as Page, label: 'People & Plans', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
      { id: 'templates', label: 'Templates', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
      { id: 'reports', label: 'Reports', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
    ],
  },
];

export function Sidebar({ page, setPage, weekData, actions, incidents }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const redFlags = weekData?.allFlags.red.length ?? 0;
  const amberFlags = weekData?.allFlags.amber.length ?? 0;
  const openActions = actions.filter(a => a.status !== 'completed').length;
  const activeIncidents = incidents.filter(i => i.stage !== 'closed').length;

  function getBadge(id: Page): ReactNode | null {
    if (id === 'dashboard' && redFlags > 0) return <span className="ml-auto pill pill-red text-[10px]">{redFlags}</span>;
    if (id === 'actions' && openActions > 0) return <span className="ml-auto pill pill-blue text-[10px]">{openActions}</span>;
    if (id === 'incidents' && activeIncidents > 0) return <span className="ml-auto pill pill-amber text-[10px]">{activeIncidents}</span>;
    return null;
  }

  function handleNav(id: Page) {
    setPage(id);
    setMobileOpen(false);
  }

  const sidebarContent = (
    <>
      {/* Logo + Brand */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src="/logo-icon-dark.png" alt="Hazelcare" className="h-10 w-10 rounded-xl relative z-10" />
            <div className="absolute inset-0 rounded-xl bg-hc-teal/25 blur-lg" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-white tracking-tight">Care Portal</div>
            <div className="text-[10px] text-hc-teal-light font-medium">Hazel Care Ltd</div>
          </div>
          {/* Mobile close */}
          <button onClick={() => setMobileOpen(false)} className="ml-auto lg:hidden text-hc-muted hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {/* Intelligence Sync — Global Access */}
        <div className="px-1.5 mb-2">
          <button 
            onClick={() => handleNav('upload')}
            className={`w-full group flex items-center gap-3 px-4 py-4 rounded-2xl border transition-all duration-500 shadow-2xl active:scale-95 ${
              page === 'upload' 
                ? 'border-hc-teal/40 bg-hc-teal/10 glow-teal translate-x-1' 
                : 'border-white/5 glass-light hover:border-hc-teal/30 hover:bg-white/5'
            }`}>
            <div className="w-10 h-10 rounded-xl bg-hc-teal/10 border border-hc-teal/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <span className="text-xl">🧠</span>
            </div>
            <div className="text-left">
              <div className="text-[10px] font-black text-white uppercase tracking-tighter group-hover:text-hc-teal-light transition-colors">Sync Intelligence</div>
              <div className="text-[8px] font-bold text-hc-muted uppercase tracking-widest opacity-40">Global Data Import</div>
            </div>
          </button>
        </div>

        {navSections.map((section, si) => (
          <div key={si}>
            {section.heading && (
              <div className="text-[10px] font-semibold text-hc-teal-light/60 uppercase tracking-[0.12em] px-3 mb-2">{section.heading}</div>
            )}
            <div className="space-y-0.5">
              {section.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-300 ease-out active:scale-[0.97] hover:scale-[1.02] ${
                    page === item.id
                      ? 'glass-teal text-hc-teal-glow font-semibold shadow-[0_0_15px_rgba(20,184,166,0.15)] translate-x-1'
                      : 'text-hc-text/70 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <span className={`transition-transform duration-500 ${page === item.id ? 'text-hc-teal-glow scale-110' : 'group-hover:scale-110'}`}>{item.icon}</span>
                  {item.label}
                  {getBadge(item.id)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Status Panel */}
      <div className="p-3 border-t border-white/[0.06] hidden lg:block">
        {weekData ? (
          <div className="glass rounded-xl p-4 transition-all duration-500 hover:scale-[1.02] hover:bg-white/[0.02] hover:border-hc-teal/20 group/status">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] text-hc-teal-light/70 uppercase tracking-wider font-semibold group-hover/status:text-hc-teal-light transition-colors">This Week</div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="group/val"><div className="text-lg font-black text-white group-hover/val:scale-110 transition-transform tabular-nums">{weekData.totalEntries}</div><div className="text-[9px] text-hc-muted font-bold uppercase tracking-tighter">Notes</div></div>
              <div className="group/val"><div className="text-lg font-black text-flag-red group-hover/val:scale-110 transition-transform tabular-nums">{redFlags}</div><div className="text-[9px] text-hc-muted font-bold uppercase tracking-tighter">Flags</div></div>
              <div className="group/val"><div className="text-lg font-black text-flag-amber group-hover/val:scale-110 transition-transform tabular-nums">{amberFlags}</div><div className="text-[9px] text-hc-muted font-bold uppercase tracking-tighter">Alerts</div></div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/[0.06]">
              <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-hc-muted/60">
                <span>{Object.keys(weekData.houses).length} Houses</span>
                <span>{weekData.clients.length} Clients</span>
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
          <a href="https://hazelcare.Hazel Carecare.com/user/login?destination=reporting/clientdiary" target="_blank" rel="noopener" className="flex-1 text-[10px] text-center py-2 text-hc-muted hover:text-hc-teal-light glass-light rounded-lg hover:border-hc-teal/30 transition-all">Hazel Care</a>
          <a href="https://org.Hazel Carecare.co.uk/hazel-care-ltd+nc-hazelcare#/" target="_blank" rel="noopener" className="flex-1 text-[10px] text-center py-2 text-hc-muted hover:text-hc-teal-light glass-light rounded-lg hover:border-hc-teal/30 transition-all">Portal</a>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3 glass border-b border-white/[0.06]">
        <button onClick={() => setMobileOpen(true)} className="text-hc-muted hover:text-white">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <img src="/logo-icon-dark.png" alt="Hazelcare" className="h-7 w-7 rounded-lg" />
        <span className="text-sm font-bold text-white">Care Portal</span>
        {redFlags > 0 && <span className="pill pill-red text-[10px] ml-auto">{redFlags}</span>}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 flex flex-col" style={{ background: 'linear-gradient(180deg, #141e30 0%, #0f1923 100%)' }}>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop Sidebar — Glass morphism */}
      <aside className="hidden lg:flex w-64 flex-col shrink-0 border-r border-white/[0.06] h-screen sticky top-0 overflow-hidden" style={{ background: 'linear-gradient(180deg, #141e30 0%, #0f1923 100%)' }}>
        {sidebarContent}
      </aside>
    </>
  );
}
