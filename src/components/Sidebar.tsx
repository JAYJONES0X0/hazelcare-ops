import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Page } from '../lib/types';
import type { WeekSummary } from '../lib/types';
import { MAIN_SECTIONS, getSectionByPage } from '../lib/navigation';

import { ORG_CONFIG } from '../lib/config';

function useBrandAssets() {
  const [logo, setLogo] = useState(() => localStorage.getItem('hc-org-logo') || '');
  const [avatar, setAvatar] = useState(() => localStorage.getItem('hc-user-avatar') || '');
  useEffect(() => {
    const refresh = () => {
      setLogo(localStorage.getItem('hc-org-logo') || '');
      setAvatar(localStorage.getItem('hc-user-avatar') || '');
    };
    window.addEventListener('hc-brand-updated', refresh);
    return () => window.removeEventListener('hc-brand-updated', refresh);
  }, []);
  return { logo, avatar };
}
import {
  LogOut, Sun, Moon, LayoutDashboard, MessageSquare,
  Users, FileText, ChevronLeft, ChevronRight, Activity, Cog
} from 'lucide-react';

interface Props {
  page: Page;
  setPage: (p: Page) => void;
  weekData: WeekSummary | null;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  onSignOut: () => void;
}

const sectionIcon: Record<string, ReactNode> = {
  'Mission Control': <LayoutDashboard size={16} />,
  'Clinical Intelligence': <Activity size={16} />,
  'Forensic Documentation': <FileText size={16} />,
  'Operations & Personnel': <Users size={16} />,
  'System Governance': <Cog size={16} />,
  Comms: <MessageSquare size={16} />,
};

export function Sidebar({ page, setPage, weekData, theme, setTheme, onSignOut }: Props) {
  const { logo: orgLogo, avatar: userAvatar } = useBrandAssets();
  const [compactViewport, setCompactViewport] = useState(() => {
    try { return window.innerWidth < 640; } catch { return false; }
  });
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('hc-sidebar-collapsed') === 'true'; } catch { return false; }
  });

  useEffect(() => {
    const syncResponsiveCollapse = () => {
      const isCompact = window.innerWidth < 640;
      setCompactViewport(isCompact);
      const shouldCollapse = window.innerWidth < 1280;
      setCollapsed((prev) => {
        if (shouldCollapse && !prev) return true;
        return prev;
      });
    };
    syncResponsiveCollapse();
    window.addEventListener('resize', syncResponsiveCollapse);
    return () => window.removeEventListener('resize', syncResponsiveCollapse);
  }, []);

  const toggleSidebar = () => setCollapsed(c => {
    const next = !c;
    try { localStorage.setItem('hc-sidebar-collapsed', String(next)); } catch { /* ignore */ }
    return next;
  });

  const activeSection = getSectionByPage(page);

  return (
    <div
      className={`h-full flex flex-col p-3 sm:p-4 bg-hc-bg z-30 shrink-0 transition-[width] duration-300 ease-in-out relative ${collapsed ? (compactViewport ? 'w-28' : 'w-16 sm:w-20') : 'w-64 lg:w-72'}`}
    >
      <button
        onClick={toggleSidebar}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-8 z-40 w-6 h-6 rounded-full hc-clay-raised border border-hc-border/20 flex items-center justify-center text-hc-muted hover:text-hc-teal transition-all shadow-md active:hc-clay-pressed"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      <div className={`hc-clay-raised mb-6 flex flex-col items-center transition-[padding,gap] duration-300 ${collapsed ? 'p-2 gap-0' : 'p-5 gap-3'}`}>
        <div className="w-10 h-10 rounded-2xl hc-clay-inset flex items-center justify-center shrink-0">
          <img src={orgLogo || ORG_CONFIG.logoIcon} alt="HC" className="w-6 h-6 object-contain" />
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

      <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-none">
        {MAIN_SECTIONS.map((section) => {
          const active = activeSection.id === section.id;
          return (
            <button
              key={section.id}
              onClick={() => setPage(section.landing)}
              className={`w-full flex items-center rounded-2xl transition-all ${
                collapsed
                  ? compactViewport ? 'justify-center flex-col gap-1 px-2 py-3' : 'justify-center gap-3 px-4 py-3'
                  : 'justify-start gap-3 px-4 py-3'
              } ${active ? 'hc-clay-pressed text-hc-teal shadow-inner shadow-black/20' : 'hc-clay-raised text-hc-muted hover:text-hc-text'}`}
              title={section.label}
              aria-label={section.label}
            >
              <span className={active ? 'text-hc-teal' : 'opacity-70'}>
                {sectionIcon[section.label] ?? <LayoutDashboard size={16} />}
              </span>
              {(!collapsed || compactViewport) && (
                <span className={`${compactViewport && collapsed ? 'text-[8px] leading-tight text-center tracking-[0.08em]' : 'text-[10px] tracking-widest'} font-black uppercase`}>
                  {section.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

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

          {/* Avatar row */}
          {!collapsed && (
            <div className="flex items-center gap-3 px-2 mb-2">
              <div className="w-8 h-8 rounded-full hc-clay-inset flex items-center justify-center overflow-hidden shrink-0 border border-hc-teal/20">
                {userAvatar
                  ? <img src={userAvatar} alt="You" className="w-full h-full object-cover" />
                  : <span className="text-[10px] font-black text-hc-muted">A</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-black text-hc-text uppercase tracking-widest truncate">Admin</div>
                <div className="text-[8px] font-bold text-hc-muted opacity-60 uppercase tracking-widest">Admin Access</div>
              </div>
            </div>
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
