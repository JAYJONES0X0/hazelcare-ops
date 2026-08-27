import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import type { Page } from '../lib/types';
import type { WeekSummary } from '../lib/types';
import { MAIN_SECTIONS, getSectionByPage, SECTION_ACCENT } from '../lib/navigation';
import { isSkinTheme, type AppTheme, type SkinTheme } from '../lib/theme';

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
  Users, FileText, ChevronLeft, ChevronRight, Activity, Cog, Palette
} from 'lucide-react';

interface Props {
  page: Page;
  setPage: (p: Page) => void;
  weekData: WeekSummary | null;
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
  mode: 'light' | 'dark';
  setMode: (m: 'light' | 'dark') => void;
  onSignOut: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const sectionIcon: Record<string, ReactNode> = {
  'Mission Control': <LayoutDashboard size={16} />,
  'Clinical Intelligence': <Activity size={16} />,
  'Forensic Documentation': <FileText size={16} />,
  'Operations & Personnel': <Users size={16} />,
  'System Governance': <Cog size={16} />,
  Comms: <MessageSquare size={16} />,
};

const skinOptions: Array<{ id: SkinTheme; label: string; color: string }> = [
  { id: 'authority', label: 'Authority purple', color: '#5d0565' },
  { id: 'critical', label: 'Critical red', color: '#9d1f2d' },
  { id: 'clinical', label: 'Clinical blue', color: '#0f4a8a' },
  { id: 'calm', label: 'Calm sage', color: '#2e5e49' },
  { id: 'focus', label: 'Focus copper', color: '#b45309' },
];

export function Sidebar({ page, setPage, weekData, theme, setTheme, mode, setMode, onSignOut, mobileOpen = false, onMobileClose }: Props) {
  // On mobile the sidebar is an off-canvas drawer; selecting a destination closes it.
  const navigate = (p: Page) => { setPage(p); onMobileClose?.(); };
  const { logo: orgLogo, avatar: userAvatar } = useBrandAssets();
  const [compactViewport, setCompactViewport] = useState(() => {
    try { return window.innerWidth < 640; } catch { return false; }
  });
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('hc-sidebar-collapsed') === 'true'; } catch { return false; }
  });
  const [skinMenuOpen, setSkinMenuOpen] = useState(false);
  const [hoveredSection, setHoveredSection] = useState<{ id: string; top: number; left: number } | null>(null);

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
  // Skin (accent color) and mode (light/dark) are independent — picking a skin no longer
  // knocks you out of dark mode, and toggling dark mode keeps whichever skin is active.
  const selectSkinTheme = (skin: SkinTheme) => {
    setTheme(theme === skin ? mode : skin);
  };
  const toggleBaseTheme = () => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  };
  const nextBaseThemeLabel = mode === 'dark' ? 'Switch to bone mode' : 'Switch to command dark mode';
  const currentSkin = isSkinTheme(theme) ? skinOptions.find((skin) => skin.id === theme) : null;
  const skinSwitcher = (
    <div className="relative shrink-0">
      <button
        onClick={() => setSkinMenuOpen(!skinMenuOpen)}
        title="Select operating skin"
        aria-label="Select operating skin"
        aria-haspopup="menu"
        aria-expanded={skinMenuOpen}
        className={`relative w-10 h-10 rounded-xl hc-clay-raised flex items-center justify-center text-hc-muted hover:text-hc-teal transition-all active:hc-clay-pressed active:scale-95 ${
          skinMenuOpen ? 'hc-clay-pressed text-hc-teal' : ''
        }`}
      >
        <Palette size={16} />
        {currentSkin && (
          <span
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-white/40 shadow-[0_0_8px_currentColor]"
            style={{ backgroundColor: currentSkin.color, color: currentSkin.color }}
          />
        )}
      </button>
      {skinMenuOpen && (
        <div className={`absolute w-56 bg-hc-surface hc-clay-raised rounded-xl border border-hc-border/20 p-2 z-50 flex flex-col gap-1 shadow-2xl ${
          collapsed ? 'left-12 bottom-0' : 'bottom-full left-0 mb-2'
        }`}>
          {skinOptions.map((skin) => {
            const active = theme === skin.id;
            return (
              <button
                key={skin.id}
                onClick={() => { selectSkinTheme(skin.id); setSkinMenuOpen(false); }}
                className={`flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-all ${
                  active ? 'bg-hc-teal/10 text-hc-teal' : 'hover:bg-hc-bg text-hc-muted hover:text-hc-text'
                }`}
              >
                <span
                  className="h-3.5 w-3.5 rounded-full shadow-[inset_1px_1px_3px_rgba(0,0,0,0.3)] shrink-0"
                  style={{ backgroundColor: skin.color }}
                />
                <span className="text-[9px] font-black uppercase tracking-widest flex-1">{skin.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`h-full flex flex-col p-3 sm:p-4 bg-hc-bg transition-all duration-300 ease-in-out w-80 max-w-[85vw] fixed inset-y-0 left-0 z-50 shadow-2xl ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:static md:translate-x-0 md:shadow-none md:z-30 md:shrink-0 ${collapsed ? (compactViewport ? 'md:w-24' : 'md:w-20') : 'md:w-64 md:lg:w-72'}`}
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
            <div className="text-[10px] font-black tracking-[0.2em] uppercase text-hc-teal whitespace-nowrap">OVSITE</div>
            <div className="text-[9px] font-bold text-hc-muted uppercase tracking-[0.3em] mt-0.5 whitespace-nowrap">
              {localStorage.getItem('hc-org-name') || ORG_CONFIG.name}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-none">
        {MAIN_SECTIONS.map((section) => {
          const active = activeSection.id === section.id;
          const accent = SECTION_ACCENT[section.id];
          return (
            <button
              key={section.id}
              onClick={() => navigate(section.landing)}
              onMouseEnter={(e) => {
                if (!collapsed || compactViewport) return;
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredSection({ id: section.id, top: rect.top + rect.height / 2, left: rect.right + 12 });
              }}
              onMouseLeave={() => setHoveredSection((h) => (h?.id === section.id ? null : h))}
              className={`w-full flex items-center rounded-2xl transition-all ${
                collapsed
                  ? compactViewport ? 'justify-center flex-col gap-1 px-2 py-3' : 'justify-center gap-3 px-4 py-3'
                  : 'justify-start gap-3 px-4 py-3'
              } ${active ? 'hc-clay-pressed text-hc-teal shadow-inner shadow-black/20' : 'hc-clay-raised text-hc-muted hover:text-hc-text'}`}
              title={collapsed ? undefined : section.label}
              aria-label={section.label}
            >
              <span style={{ color: accent }} className={active ? '' : 'opacity-55'}>
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

        {hoveredSection && collapsed && !compactViewport && createPortal(
          (() => {
            const section = MAIN_SECTIONS.find(s => s.id === hoveredSection.id);
            if (!section) return null;
            const accent = SECTION_ACCENT[section.id];
            return (
              <div
                className="pointer-events-none fixed z-[100] w-56 animate-in fade-in slide-in-from-left-1 duration-150"
                style={{ top: hoveredSection.top, left: hoveredSection.left, transform: 'translateY(-50%)' }}
              >
                <div className="hc-clay-raised bg-hc-surface rounded-xl border border-hc-border/20 shadow-2xl p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: accent }} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-hc-text">{section.label}</span>
                  </div>
                  <p className="text-[9px] font-bold text-hc-muted leading-relaxed">
                    {section.tabs.map(t => t.label).join(' · ')}
                  </p>
                </div>
              </div>
            );
          })(),
          document.body
        )}
      </div>

      <div className="mt-auto pt-6 space-y-4">
        <div className={`hc-clay-raised space-y-4 transition-all duration-300 ${collapsed ? 'p-2' : 'p-4'}`}>
          {!collapsed && (
            <>
              <div className="flex items-center justify-between px-2">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-hc-teal uppercase tracking-widest mb-1">Status</span>
                  <span className="text-[10px] font-black text-hc-text uppercase tabular-nums">{weekData ? Object.values(weekData.houses).length : 0} Units Loaded</span>
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
              <div className="w-2 h-2 rounded-full bg-hc-green animate-pulse mb-2" title={`${weekData ? Object.values(weekData.houses).length : 0} units loaded`} />
            )}
            {skinSwitcher}
            <button
              onClick={toggleBaseTheme}
              title={nextBaseThemeLabel}
              className="w-10 h-10 rounded-xl hc-clay-raised flex items-center justify-center text-hc-muted hover:text-hc-teal transition-all active:hc-clay-pressed active:scale-95 shrink-0"
            >
              {mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {!collapsed ? (
              <button
                onClick={onSignOut}
                className="flex-1 h-10 rounded-xl hc-clay-raised flex items-center justify-center gap-2 text-[10px] font-black text-hc-muted hover:text-hc-red transition-all active:hc-clay-pressed active:scale-95 uppercase tracking-widest"
              >
                <LogOut size={14} /> Sign Out
              </button>
            ) : (
              <button
                onClick={onSignOut}
                title="Sign Out"
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
