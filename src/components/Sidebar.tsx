import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Page } from '../App';
import type { Action, WeekSummary } from '../lib/types';

import { ORG_CONFIG } from '../lib/config';
import {
  LogOut, Sun, Moon, LayoutDashboard, MessageSquare, Upload, BookOpen, Shield,
  Zap, AlertTriangle, BarChart3, Users, FileText, Briefcase, ClipboardCheck,
  Database, Settings2, Sparkles, ChevronLeft, ChevronRight,
} from 'lucide-react';

interface Props {
  page: Page;
  setPage: (p: Page) => void;
  weekData: WeekSummary | null;
  actions: Action[];
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  onSignOut: () => void;
}

const navSections: { items: { id: Page; label: string; icon: ReactNode }[] }[] = [
  {
    items: [
      { id: 'briefing' as Page,      label: 'Mission Briefing',  icon: <LayoutDashboard size={18} /> },
      { id: 'dashboard',             label: 'Sitrep Center',     icon: <BarChart3 size={18} /> },
      { id: 'communications' as Page,label: 'Comms Intercept',   icon: <MessageSquare size={18} /> },
      { id: 'upload',                label: 'Field Injest',       icon: <Upload size={18} /> },
    ],
  },
  {
    items: [
      { id: 'client-diary' as Page,    label: 'Diagnostic Feed',   icon: <BookOpen size={18} /> },
      { id: 'staff-monitoring' as Page,label: 'Force Protection',  icon: <Shield size={18} /> },
      { id: 'actions',                 label: 'Command Vectors',   icon: <Zap size={18} /> },
      { id: 'incidents',               label: 'Incident Govt',     icon: <AlertTriangle size={18} /> },
      { id: 'staff',                   label: 'Personnel Ledger',  icon: <Users size={18} /> },
    ],
  },
  {
    items: [
      { id: 'notes' as Page,          label: 'Note Intelligence', icon: <FileText size={18} /> },
      { id: 'note-workspace' as Page, label: 'Note Workspace',    icon: <Sparkles size={18} /> },
    ],
  },
  {
    items: [
      { id: 'agency' as Page,     label: 'External Support',  icon: <Briefcase size={18} /> },
      { id: 'compliance',         label: 'Regulatory Audit',  icon: <ClipboardCheck size={18} /> },
      { id: 'templates',          label: 'Builder Templates', icon: <Database size={18} /> },
      { id: 'settings' as Page,   label: 'System Settings',   icon: <Settings2 size={18} /> },
    ],
  },
];

export function Sidebar({ page, setPage, weekData, actions, theme, setTheme, onSignOut }: Props) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('hc-sidebar-collapsed') === 'true'; } catch { return false; }
  });

  const toggle = () => setCollapsed(c => {
    const next = !c;
    try { localStorage.setItem('hc-sidebar-collapsed', String(next)); } catch { /* ignore */ }
    return next;
  });

  const openActionsCount = actions.filter(a => a.status !== 'completed').length;

  return (
    <div
      className={`h-full flex flex-col p-5 bg-hc-bg z-30 shrink-0 transition-all duration-300 ease-in-out relative ${collapsed ? 'w-20' : 'w-64'}`}
    >
      {/* Collapse toggle */}
      <button
        onClick={toggle}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-8 z-40 w-6 h-6 rounded-full hc-clay-raised border border-hc-border/20 flex items-center justify-center text-hc-muted hover:text-hc-teal transition-all shadow-md"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Brand Header */}
      <div className={`hc-clay-raised mb-8 flex flex-col items-center transition-all duration-300 ${collapsed ? 'p-3 gap-0' : 'p-6 gap-3'}`}>
        <div className="w-10 h-10 rounded-2xl hc-clay-inset flex items-center justify-center shrink-0">
          <img src={ORG_CONFIG.logoIcon} alt="HC" className="w-6 h-6 opacity-80" />
        </div>
        {!collapsed && (
          <div className="text-center overflow-hidden">
            <div className="text-[10px] font-black tracking-[0.2em] uppercase text-hc-teal whitespace-nowrap">Operational Core</div>
            <div className="text-[9px] font-bold text-hc-muted uppercase tracking-[0.3em] mt-0.5 whitespace-nowrap">{ORG_CONFIG.name}</div>
          </div>
        )}
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-8 scrollbar-none">
        {navSections.map((section, idx) => (
          <div key={idx} className="space-y-1.5">
            {section.items.map((item) => {
              const active = page === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center transition-all duration-300 group relative
                    ${collapsed ? 'justify-center px-2 py-3 rounded-2xl' : 'justify-between px-5 py-3.5 rounded-full'}
                    ${active
                      ? 'bg-hc-teal text-white shadow-[4px_4px_10px_rgba(77,124,120,0.3)]'
                      : 'text-hc-muted hover:text-hc-text hover:bg-hc-clay shadow-none hover:shadow-[4px_4px_8px_var(--hc-clay-dark)]'
                    }`}
                >
                  <div className={`flex items-center ${collapsed ? '' : 'gap-4'}`}>
                    <span className={`${active ? 'text-white' : 'text-hc-teal opacity-60 group-hover:opacity-100'} transition-all shrink-0`}>
                      {item.icon}
                    </span>
                    {!collapsed && (
                      <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                    )}
                  </div>
                  {item.id === 'actions' && openActionsCount > 0 && (
                    <span className={`flex items-center justify-center text-[8px] font-black rounded-full
                      ${active ? 'bg-white text-hc-teal' : 'bg-hc-red text-white'}
                      ${collapsed ? 'absolute -top-1 -right-1 w-4 h-4' : 'w-5 h-5'}`}>
                      {openActionsCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer Controls */}
      <div className="mt-auto pt-6 space-y-4">
        <div className={`hc-clay-inset space-y-4 transition-all duration-300 ${collapsed ? 'p-3' : 'p-5'}`}>
          {!collapsed && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-hc-teal uppercase tracking-widest mb-1">Status</span>
                  <span className="text-[10px] font-black text-hc-text uppercase tabular-nums">{weekData ? Object.values(weekData.houses).length : 0} Sites Active</span>
                </div>
                <div className="w-2 h-2 rounded-full bg-hc-green animate-pulse shadow-[0_0_8px_var(--hc-green)]" />
              </div>
              <div className="h-px bg-hc-clay-dark opacity-30" />
            </>
          )}

          <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : ''}`}>
            {collapsed && (
              <div className="w-2 h-2 rounded-full bg-hc-green animate-pulse mb-1" title={`${weekData ? Object.values(weekData.houses).length : 0} sites active`} />
            )}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              className="w-10 h-10 rounded-xl hc-clay-raised flex items-center justify-center text-hc-muted hover:text-hc-teal transition-all active:scale-95 shrink-0"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {!collapsed ? (
              <button
                onClick={onSignOut}
                className="flex-1 h-10 rounded-xl hc-clay-raised flex items-center justify-center gap-2 text-[9px] font-black text-hc-muted hover:text-hc-red transition-all active:scale-95 uppercase tracking-widest"
              >
                <LogOut size={14} /> Exit Core
              </button>
            ) : (
              <button
                onClick={onSignOut}
                title="Exit Core"
                className="w-10 h-10 rounded-xl hc-clay-raised flex items-center justify-center text-hc-muted hover:text-hc-red transition-all active:scale-95"
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
