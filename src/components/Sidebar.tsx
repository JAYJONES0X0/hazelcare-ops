import type { ReactNode } from 'react';
import type { Page } from '../App';
import type { Action, Incident, WeekSummary } from '../lib/types';
import { ORG_CONFIG } from '../lib/config';
import { LogOut, Sun, Moon, Info } from 'lucide-react';

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

const navSections: { items: { id: Page; label: string; icon: ReactNode }[] }[] = [
  {
    items: [
      { id: 'briefing' as Page, label: 'MISSION BRIEFING', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg> },
      { id: 'dashboard', label: 'SITREP CENTER', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" /></svg> },
      { id: 'communications' as Page, label: 'COMMS_INTERCEPT', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg> },
      { id: 'upload', label: 'FIELD INJEST MATRIX', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> },
    ],
  },
  {
    items: [
      { id: 'client-diary' as Page, label: 'DIAGNOSTIC FEED', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg> },
      { id: 'staff-monitoring' as Page, label: 'Force Protection', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> },
      { id: 'actions', label: 'Command Vectors', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> },
      { id: 'incidents', label: 'Incident Governance', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg> },
      { id: 'risk', label: 'STABILITY VECTORS', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
      { id: 'staff', label: 'Personnel Ledger', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
    ],
  },
  {
    items: [
      { id: 'notes' as Page, label: 'Note Intelligence', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
    ],
  },
  {
    items: [
      { id: 'agency' as Page, label: 'External Support', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
      { id: 'compliance', label: 'Regulatory Audit', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> },
      { id: 'client-docs' as Page, label: 'Asset Readiness', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
      { id: 'templates', label: 'SYNTHESIS MATRIX', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
      { id: 'reports', label: 'DIAGNOSTIC LEDGER', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
      { id: 'admin' as Page, label: 'System Control', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
    ],
  },
];

export function Sidebar({ page, setPage, weekData, actions, incidents, theme, setTheme, onSignOut }: Props) {
  const openActionsCount = actions.filter(a => a.status !== 'completed').length;
  const highIncidentsCount = incidents.filter(i => i.severity === 'red').length;

  return (
    <div className="flex flex-col w-64 h-full border-r border-hc-border bg-hc-navy/40 backdrop-blur-xl animate-in fade-in slide-in-from-left-4 duration-700">
      <div className="p-6 border-b border-hc-border text-center">
        <div className="inline-block px-4 py-2 border-2 border-hc-teal/40 bg-hc-teal/5 text-hc-text rounded">
          <div className="text-[12px] font-black tracking-widest uppercase">Operational In...</div>
          <div className="text-[8px] font-bold text-hc-teal uppercase tracking-[0.4em] opacity-80 mt-1">{ORG_CONFIG.name}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8 scrollbar-none">
        {navSections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {section.items.map((item) => (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all group ${
                  page === item.id 
                    ? 'bg-hc-teal text-white shadow-lg shadow-hc-teal/20' 
                    : 'text-hc-muted hover:bg-hc-card-hover hover:text-hc-text border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`${page === item.id ? 'text-white' : 'text-hc-teal group-hover:scale-110 transition-transform'}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.id === 'actions' && openActionsCount > 0 && (
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${page === 'actions' ? 'bg-white text-hc-teal' : 'bg-red-500 text-white animate-pulse'}`}>
                    {openActionsCount}
                  </span>
                )}
                {item.id === 'incidents' && highIncidentsCount > 0 && (
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-black bg-red-500 text-white animate-pulse`}>
                    {highIncidentsCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="p-4 mt-auto border-t border-hc-border bg-hc-navy/20">
        <div className="bg-hc-card p-4 rounded-xl border border-hc-border shadow-inner">
          <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest mb-3 flex items-center gap-2">
            <Info className="w-3 h-3" /> This Week
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xl font-black text-hc-text tabular-nums">{weekData ? Object.values(weekData.houses).reduce((acc, h) => acc + h.entries.length, 0) : '0'}</div>
              <div className="text-[7px] font-bold text-hc-muted uppercase tracking-widest">Notes</div>
            </div>
            <div>
              <div className="text-xl font-black text-hc-text tabular-nums">{weekData ? Object.values(weekData.houses).length : '0'}</div>
              <div className="text-[7px] font-bold text-hc-muted uppercase tracking-widest">Houses</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 px-2">
          <div className="flex gap-1">
             <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2.5 bg-hc-card border border-hc-border rounded-lg text-hc-muted hover:text-hc-text transition-all active:scale-90">
               {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
             </button>
             <button onClick={onSignOut} className="p-2.5 bg-hc-card border border-hc-border rounded-lg text-hc-muted hover:text-red-500 transition-all active:scale-90">
               <LogOut className="w-4 h-4" />
             </button>
          </div>
          <div className="text-right">
            <div className="text-[8px] font-black text-hc-text uppercase opacity-40">System_v4.2</div>
            <div className="text-[7px] font-bold text-hc-teal uppercase tracking-widest">Encrypted</div>
          </div>
        </div>
      </div>
    </div>
  );
}
