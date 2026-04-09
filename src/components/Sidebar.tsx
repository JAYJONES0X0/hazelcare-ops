import { useState, useEffect, type ReactNode } from 'react';
import type { Page } from '../App';
import type { WeekSummary, Action, Incident } from '../lib/types';

interface Props {
  page: Page;
  setPage: (p: Page) => void;
  weekData: WeekSummary | null;
  actions: Action[];
  incidents: Incident[];
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  onSignOut: () => void;
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
      { id: 'staff-monitoring' as Page, label: 'Staff Intelligence', icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> },
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

export function Sidebar({ page, setPage, weekData, actions, incidents, theme, setTheme, onSignOut }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [customLogo, setCustomLogo] = useState<string | null>(() => localStorage.getItem('hc-custom-logo-v1'));
  const isLight = theme === 'light';

  // Listen for logo changes from Settings page
  useEffect(() => {
    const handler = () => setCustomLogo(localStorage.getItem('hc-custom-logo-v1'));
    window.addEventListener('hc-logo-change', handler);
    return () => window.removeEventListener('hc-logo-change', handler);
  }, []);
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

  const shellBorder = isLight ? 'border-hc-border' : 'border-white/[0.06]';
  const brandTitle = isLight ? 'text-hc-text' : 'text-white';
  const asideBg = isLight
    ? { background: 'linear-gradient(180deg, #eef6fb 0%, #e2edf6 100%)' }
    : { background: 'linear-gradient(180deg, #0a0d14 0%, #060810 100%)', borderRight: '1px solid rgba(255,255,255,0.06)' };

  const sidebarContent = (
    <>
      {/* Logo + Brand */}
      <div className={`p-3 border-b ${shellBorder}`}>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <img src={customLogo || '/logo-icon-dark.png'} alt="Hazelcare" className="h-8 w-8 rounded-lg relative z-10 object-cover" />
            <div className="absolute inset-0 rounded-xl bg-hc-teal/25 blur-lg" />
          </div>
          <div className="flex-1">
            <div className={`text-xs font-bold tracking-tight ${brandTitle}`}>Care Portal</div>
            <div className="text-[10px] text-hc-teal font-medium">Hazel Care Ltd</div>
          </div>
          {/* Mobile close */}
          <button onClick={() => setMobileOpen(false)} className={`ml-auto lg:hidden p-1.5 rounded-lg ${isLight ? 'text-hc-muted hover:text-hc-text hover:bg-black/[0.06]' : 'text-hc-muted hover:text-white'}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-2.5 space-y-3 overflow-y-auto scrollbar-thin">
        {navSections.map((section, si) => (          <div key={si}>
            {section.heading && (
              <div className={`text-[10px] font-semibold uppercase tracking-[0.04em] px-2.5 mb-1 ${isLight ? 'text-hc-teal' : 'text-hc-teal-light/80'}`}>{section.heading}</div>
            )}
            <div className="space-y-px">
              {section.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-200 ease-out active:scale-[0.98] ${
                    page === item.id
                      ? isLight
                        ? 'sidebar-nav-active font-semibold'
                        : 'bg-hc-teal/[0.08] text-hc-teal-light font-semibold border-l-2 border-hc-teal/50'
                      : isLight
                        ? 'text-hc-text/80 hover:text-hc-text hover:bg-black/[0.05]'
                        : 'text-hc-muted hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <span className={`shrink-0 transition-transform duration-300 ${page === item.id ? (isLight ? 'text-hc-teal scale-105' : 'text-hc-teal-glow scale-110') : ''}`}>{item.icon}</span>
                  <span className="truncate text-left">{item.label}</span>
                  {getBadge(item.id)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Status Panel */}
      <div className={`p-3 border-t ${shellBorder} hidden lg:block`}>
        {weekData ? (
          <div className="rounded-xl p-3 transition-all duration-300"
            style={{
              background: 'linear-gradient(145deg, rgba(16,18,26,0.9), rgba(10,12,18,0.85))',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.07)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
            }}>
            <div className="text-[9px] font-black tracking-[0.2em] text-hc-teal uppercase mb-3">This Week</div>
            <div className="grid grid-cols-3 gap-1.5 text-center mb-3">
              <div><div className="text-xl font-black tabular-nums text-white">{weekData.totalEntries}</div><div className="text-[9px] text-hc-muted font-bold uppercase tracking-wide opacity-60">Notes</div></div>
              <div><div className="text-xl font-black text-flag-red tabular-nums">{redFlags}</div><div className="text-[9px] text-hc-muted font-bold uppercase tracking-wide opacity-60">Flags</div></div>
              <div><div className="text-xl font-black text-flag-amber tabular-nums">{amberFlags}</div><div className="text-[9px] text-hc-muted font-bold uppercase tracking-wide opacity-60">Alerts</div></div>
            </div>
            <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-hc-muted opacity-50 pt-2" style={{borderTop:'1px solid rgba(255,255,255,0.05)'}}>
              <span>{Object.keys(weekData.houses).length} Houses</span>
              <span>{weekData.clients.length} Clients</span>
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-hc-muted text-center py-3 opacity-40">No data loaded</div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="px-3 pb-4 hidden lg:block space-y-2">
        {/* Theme toggle */}
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 group cursor-pointer"
          style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)'}}
        >
          {theme === 'dark' ? (
            <svg className="w-3.5 h-3.5 text-hc-muted group-hover:text-hc-teal-light transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-hc-muted group-hover:text-hc-teal-light transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
          )}
          <span className="text-[11px] font-semibold text-hc-muted group-hover:text-white transition-colors">
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </span>
          <div className="ml-auto w-8 h-4 rounded-full flex items-center px-0.5 transition-colors duration-200"
            style={{background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(20,184,166,0.4)'}}>
            <div className="w-3 h-3 rounded-full transition-all duration-200"
              style={{background: theme === 'dark' ? '#475569' : '#14b8a6', transform: theme === 'dark' ? 'translateX(0)' : 'translateX(16px)'}} />
          </div>
        </button>

        {/* Profile / Settings row */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleNav('settings' as Page)}
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all group"
            style={{
              background: page === 'settings' ? 'rgba(20,184,166,0.08)' : 'rgba(255,255,255,0.03)',
              border: page === 'settings' ? '1px solid rgba(20,184,166,0.3)' : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black text-white shrink-0"
              style={{background:'linear-gradient(135deg,#0f766e,#14b8a6)'}}>
              {(() => {
                const name = localStorage.getItem('hc-profile-v1');
                try { const p = name ? JSON.parse(name) : null; return p?.name?.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase() || 'HC'; } catch { return 'HC'; }
              })()}
            </div>
            <span className="text-[11px] font-semibold text-hc-muted group-hover:text-white transition-colors truncate">Settings</span>
            <svg className="w-3 h-3 text-hc-muted/40 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
          <button
            type="button"
            onClick={onSignOut}
            title="Sign out"
            className="w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer transition-all hover:text-flag-red group"
            style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)'}}
          >
            <svg className="w-3.5 h-3.5 text-hc-muted/50 group-hover:text-flag-red transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>

        {/* Quick links */}
        <div className="flex gap-2">
          <a href="https://www.hazelcare.co.uk" target="_blank" rel="noopener noreferrer"
            className="flex-1 text-[10px] font-medium text-center py-1.5 text-hc-muted/40 hover:text-hc-muted rounded-lg transition-colors"
            style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.04)'}}>
            Hazel Care
          </a>
          <a href="https://login.nourishcare.com" target="_blank" rel="noopener noreferrer"
            className="flex-1 text-[10px] font-medium text-center py-1.5 text-hc-muted/40 hover:text-hc-muted rounded-lg transition-colors"
            style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.04)'}}>
            CarePlanner
          </a>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className={`lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3 glass border-b ${shellBorder}`}>
        <button type="button" onClick={() => setMobileOpen(true)} className={isLight ? 'text-hc-muted hover:text-hc-text' : 'text-hc-muted hover:text-white'} aria-label="Open menu">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <img src="/logo-icon-dark.png" alt="Hazelcare" className="h-7 w-7 rounded-lg" />
        <span className={`text-sm font-bold ${brandTitle}`}>Care Portal</span>
        {redFlags > 0 && <span className="pill pill-red text-[10px] ml-auto">{redFlags}</span>}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 flex flex-col border-r border-black/10" style={asideBg}>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop Sidebar — Glass morphism */}
      <aside className={`hidden lg:flex w-[14rem] flex-col shrink-0 h-screen sticky top-0 overflow-hidden ${isLight ? 'border-r border-hc-border' : 'border-r border-white/[0.06]'}`} style={asideBg}>
        {sidebarContent}
      </aside>
    </>
  );
}
