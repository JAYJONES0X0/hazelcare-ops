import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Page } from '../App';
import type { Action, WeekSummary } from '../lib/types';

import { ORG_CONFIG } from '../lib/config';
import {
  LogOut, Sun, Moon, LayoutDashboard, MessageSquare, Upload, BookOpen, Shield,
  Zap, AlertTriangle, BarChart3, Users, FileText, Briefcase, ClipboardCheck,
  Database, Settings2, Sparkles, ChevronLeft, ChevronRight, Activity, HardDrive,
  UserCheck, ShieldCheck, Cog, TrendingUp
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
  color: string;
  items: { id: Page; label: string; icon: ReactNode }[];
}

const navSections: NavSection[] = [
  {
    label: 'Mission Control',
    icon: <LayoutDashboard size={16} />,
    color: 'text-hc-teal',
    items: [
      { id: 'briefing' as Page,      label: 'Strategy Briefing', icon: <LayoutDashboard size={16} /> },
      { id: 'dashboard',             label: 'Sitrep Center',     icon: <BarChart3 size={16} /> },
      { id: 'empire-matrix' as Page,   label: 'Empire Matrix',     icon: <TrendingUp size={16} /> },
      { id: 'upload',                label: 'Field Injest',      icon: <Upload size={16} /> },
      { id: 'communications' as Page,label: 'Comms Intercept',   icon: <MessageSquare size={16} /> },
    ],
  },
  {
    label: 'Clinical Intelligence',
    icon: <Activity size={16} />,
    color: 'text-hc-teal-light',
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
    color: 'text-flag-amber',
    items: [
      { id: 'staff',                   label: 'Personnel Ledger',  icon: <Users size={16} /> },
      { id: 'staff-monitoring' as Page,label: 'Force Protection',  icon: <Shield size={16} /> },
      { id: 'compliance',              label: 'Personnel Audit',   icon: <UserCheck size={16} /> },
      { id: 'notes' as Page,           label: 'Dictation & Core Notes', icon: <FileText size={16} /> },
    ],
  },
  {
    label: 'Operations & Audit',
    icon: <Zap size={16} />,
    color: 'text-flag-red',
    items: [
      { id: 'actions',                 label: 'Command Vectors',   icon: <Zap size={16} /> },
      { id: 'incidents',               label: 'Incident Govt',     icon: <AlertTriangle size={16} /> },
      { id: 'reports' as Page,         label: 'Regulatory Audit',  icon: <ClipboardCheck size={16} /> },
      { id: 'agency' as Page,          label: 'External Support',  icon: <Briefcase size={16} /> },
      { id: 'risk' as Page,            label: 'Risk Matrix',       icon: <Activity size={16} /> },
    ],
  },
  {
    label: 'Sovereign System',
    icon: <Cog size={16} />,
    color: 'text-hc-muted',
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

  // Auto-collapse sections: when page changes, expand only the owning section
  useEffect(() => {
    if (collapsed) return;
    const ownerSection = navSections.find(s => s.items.some(i => i.id === page));
    if (!ownerSection) return;
    const next: Record<string, boolean> = {};
    for (const s of navSections) next[s.label] = s.label === ownerSection.label;
    try { localStorage.setItem('hc-sidebar-expanded', JSON.stringify(next)); } catch { /* ignore */ }
    setExpandedSections(next);
  }, [page, collapsed]);

  const openActionsCount = actions.filter(a => a.status !== 'completed').length;

  return (
    <div
      className={`h-full flex flex-col p-4 bg-hc-bg z-30 shrink-0 transition-[width] duration-300 ease-in-out relative ${collapsed ? 'w-20' : 'w-72'}`}
    >
      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-8 z-40 w-6 h-6 rounded-full hc-clay-raised border border-hc-border/20 flex items-center justify-center text-hc-muted hover:text-hc-teal transition-all shadow-md active:hc-clay-pressed"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Brand Header */}
      <div className={`hc-clay-raised mb-6 flex flex-col items-center transition-[padding,gap] duration-300 ${collapsed ? 'p-2 gap-0' : 'p-5 gap-3'}`}>
        <div className="w-10 h-10 rounded-2xl hc-clay-inset flex items-center justify-center shrink-0">
          <img src={ORG_CONFIG.logoIcon} alt="HC" className="w-6 h-6 opacity-80" />
        </div>
        {!collapsed && (
          <div className="text-center overflow-hidden">
            <div className="text-[10px] font-black tracking-[0.2em] uppercase text-hc-teal whitespace-nowrap">Operational Core</div>
            <div className="text-[9px] font-bold text-hc-muted uppercase tracking-[0.3em] mt-0.5 whitespace-nowrap">
              {localStorage.getItem('hc-org-name') || ORG_CONFIG.name}
            </div>
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
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all ${
                  collapsed ? 'justify-center hc-clay-raised' : 'justify-between'
                } ${hasActiveItem && !isExpanded ? 'hc-clay-raised ' + section.color : 'text-hc-muted hover:text-hc-text'}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`${hasActiveItem ? section.color : 'opacity-60'}`}>{section.icon}</span>
                  {!collapsed && <span className={`text-[10px] font-black uppercase tracking-widest ${hasActiveItem ? section.color : ''}`}>{section.label}</span>}
                </div>
                {!collapsed && (
                  <ChevronRight size={12} className={`text-hc-text opacity-20 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                )}
              </button>

              {isExpanded && !collapsed && (
                <div className="space-y-2 ml-4 border-l border-hc-border/10 pl-3 animate-in slide-in-from-top-2 duration-300">
                  {section.items.map((item) => {
                    const active = page === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setPage(item.id)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 group active:hc-clay-pressed relative
                          ${active
                            ? 'hc-clay-pressed ' + section.color + ' shadow-inner shadow-black/20'
                            : 'text-hc-text/50 hover:text-hc-text hover:hc-clay-raised'
                          }`}
                      >
                        {active && (
                          <div className={`absolute left-0 top-1/4 bottom-1/4 w-1 rounded-full animate-in fade-in duration-1000 ${section.color.replace('text-', 'bg-')}`} 
                               style={{ boxShadow: `0 0 12px currentColor` }} />
                        )}
                        <div className="flex items-center gap-3">
                          <span className={`${active ? section.color : 'opacity-40 group-hover:opacity-100'}`}>
                            {item.icon}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                        </div>
                        {item.id === 'actions' && openActionsCount > 0 && (
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black ${active ? 'bg-hc-teal text-hc-bone' : 'bg-hc-red text-hc-bone'}`}>
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
        <div className={`hc-clay-raised space-y-4 transition-all duration-300 ${collapsed ? 'p-2' : 'p-4'}`}>
          {!collapsed && (
            <>
              <div className="flex items-center justify-between px-2">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-hc-teal uppercase tracking-widest mb-1">Status</span>
                  <span className="text-[10px] font-black text-hc-text uppercase tabular-nums">{weekData ? Object.values(weekData.houses).length : 0} Sites Active</span>
                </div>
                <div className="w-2 h-2 rounded-full bg-hc-green animate-pulse shadow-[0_0_8px_var(--hc-green)]" />
              </div>
              <div className="h-px bg-hc-border opacity-20 mx-2" />
            </>
          )}

          <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : ''}`}>
            {collapsed && (
              <div className="w-2 h-2 rounded-full bg-hc-green animate-pulse mb-2" title={`${weekData ? Object.values(weekData.houses).length : 0} sites active`} />
            )}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              className="w-10 h-10 rounded-xl hc-clay-raised flex items-center justify-center text-hc-muted hover:text-hc-teal transition-all active:hc-clay-pressed active:scale-95 shrink-0"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {!collapsed ? (
              <button
                onClick={onSignOut}
                className="flex-1 h-10 rounded-xl hc-clay-raised flex items-center justify-center gap-2 text-[10px] font-black text-hc-muted hover:text-hc-red transition-all active:hc-clay-pressed active:scale-95 uppercase tracking-widest"
              >
                <LogOut size={14} /> Exit Core
              </button>
            ) : (
              <button
                onClick={onSignOut}
                title="Exit Core"
                className="w-10 h-10 rounded-xl hc-clay-raised flex items-center justify-center text-hc-muted hover:text-hc-red transition-all active:hc-clay-pressed active:scale-95"
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
