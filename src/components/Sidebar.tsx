import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Page } from '../App';
import type { Action, WeekSummary } from '../lib/types';

import { ORG_CONFIG } from '../lib/config';
import {
  LogOut, Sun, Moon, LayoutDashboard, MessageSquare, Upload, BookOpen, Shield,
  Zap, AlertTriangle, BarChart3, Users, FileText, Briefcase, ClipboardCheck,
  Database, Settings2, Sparkles, ChevronLeft, ChevronRight, Activity, HardDrive,
  UserCheck, ShieldCheck, Cog
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

interface NavSection {
  label: string;
  icon: ReactNode;
  items: { id: Page; label: string; icon: ReactNode }[];
}

const navSections: NavSection[] = [
  {
    label: 'Mission Control',
    icon: <LayoutDashboard size={16} />,
    items: [
      { id: 'briefing' as Page,      label: 'Strategy Briefing', icon: <LayoutDashboard size={16} /> },
      { id: 'dashboard',             label: 'Sitrep Center',     icon: <BarChart3 size={16} /> },
      { id: 'upload',                label: 'Field Injest',      icon: <Upload size={16} /> },
      { id: 'communications' as Page,label: 'Comms Intercept',   icon: <MessageSquare size={16} /> },
    ],
  },
  {
    label: 'Clinical Intelligence',
    icon: <Activity size={16} />,
    items: [
      { id: 'note-workspace' as Page, label: 'Note Workspace',    icon: <Sparkles size={16} /> },
      { id: 'client-diary' as Page,    label: 'Diagnostic Feed',   icon: <BookOpen size={16} /> },
      { id: 'client-docs' as Page,     label: 'Clinical Records',  icon: <HardDrive size={16} /> },
      { id: 'handover' as Page,        label: 'Clinical Handover', icon: <FileText size={16} /> },
      { id: 'templates',               label: 'Builder Templates', icon: <Database size={16} /> },
    ],
  },
  {
    label: 'Personnel & Protection',
    icon: <ShieldCheck size={16} />,
    items: [
      { id: 'staff',                   label: 'Personnel Ledger',  icon: <Users size={16} /> },
      { id: 'staff-monitoring' as Page,label: 'Force Protection',  icon: <Shield size={16} /> },
      { id: 'compliance',              label: 'Personnel Audit',   icon: <UserCheck size={16} /> },
      { id: 'notes' as Page,           label: 'Staff Supervision', icon: <FileText size={16} /> },
    ],
  },
  {
    label: 'Operations & Audit',
    icon: <Zap size={16} />,
    items: [
      { id: 'actions',                 label: 'Command Vectors',   icon: <Zap size={16} /> },
      { id: 'incidents',               label: 'Incident Govt',     icon: <AlertTriangle size={16} /> },
      { id: 'compliance',              label: 'Regulatory Audit',  icon: <ClipboardCheck size={16} /> },
      { id: 'agency' as Page,          label: 'External Support',  icon: <Briefcase size={16} /> },
      { id: 'risk' as Page,            label: 'Risk Matrix',       icon: <Activity size={16} /> },
    ],
  },
  {
    label: 'Sovereign System',
    icon: <Cog size={16} />,
    items: [
      { id: 'settings' as Page,   label: 'System Settings',   icon: <Settings2 size={16} /> },
      { id: 'admin' as Page,      label: 'Admin Matrix',      icon: <Shield size={16} /> },
    ],
  },
];

export function Sidebar({ page, setPage, weekData, actions, theme, setTheme, onSignOut }: Props) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('hc-sidebar-collapsed') === 'true'; } catch { return false; }
  });

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('hc-sidebar-expanded');
    return saved ? JSON.parse(saved) : { 'Mission Control': true, 'Clinical Intelligence': true };
  });

  const toggleSidebar = () => setCollapsed(c => {
    const next = !c;
    try { localStorage.setItem('hc-sidebar-collapsed', String(next)); } catch { /* ignore */ }
    return next;
  });

  const toggleSection = (label: string) => {
    if (collapsed) {
      setCollapsed(false);
      setExpandedSections(prev => ({ ...prev, [label]: true }));
      return;
    }
    setExpandedSections(prev => {
      const next = { ...prev, [label]: !prev[label] };
      localStorage.setItem('hc-sidebar-expanded', JSON.stringify(next));
      return next;
    });
  };

  const openActionsCount = actions.filter(a => a.status !== 'completed').length;

  return (
    <div
      className={`h-full flex flex-col p-5 bg-hc-bg z-30 shrink-0 transition-all duration-300 ease-in-out relative ${collapsed ? 'w-24' : 'w-72'}`}
    >
      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
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
      <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-none">
        {navSections.map((section) => {
          const isExpanded = expandedSections[section.label];
          const hasActiveItem = section.items.some(item => page === item.id);

          return (
            <div key={section.label} className="space-y-1">
              <button
                onClick={() => toggleSection(section.label)}
                className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl transition-all ${
                  collapsed ? 'justify-center' : 'justify-between'
                } ${hasActiveItem && !isExpanded ? 'text-hc-teal' : 'text-hc-text hover:text-hc-teal'}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`${hasActiveItem ? 'text-hc-teal' : 'text-hc-text opacity-40'}`}>{section.icon}</span>
                  {!collapsed && <span className="text-[10px] font-black uppercase tracking-widest">{section.label}</span>}
                </div>
                {!collapsed && (
                  <ChevronRight size={12} className={`text-hc-text opacity-20 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                )}
              </button>

              {isExpanded && !collapsed && (
                <div className="space-y-1 ml-4 border-l border-hc-border/10 pl-2 animate-in slide-in-from-top-2 duration-300">
                  {section.items.map((item) => {
                    const active = page === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setPage(item.id)}
                        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full transition-all duration-300 group
                          ${active
                            ? 'bg-hc-teal text-hc-bone shadow-md'
                            : 'text-hc-text/60 hover:text-hc-text hover:bg-hc-clay'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`${active ? 'text-hc-bone' : 'text-hc-teal opacity-40 group-hover:opacity-100'}`}>
                            {item.icon}
                          </span>
                          <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
                        </div>
                        {item.id === 'actions' && openActionsCount > 0 && (
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black ${active ? 'bg-hc-bone text-hc-teal' : 'bg-hc-red text-hc-bone'}`}>
                            {openActionsCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
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
