import type { ReactNode } from 'react';
import type { Page } from '../App';
import type { Action, Incident, WeekSummary } from '../lib/types';
import { ORG_CONFIG } from '../lib/config';
import { LogOut, Sun, Moon, Info, Settings, LayoutDashboard, MessageSquare, Upload, BookOpen, Shield, Zap, AlertTriangle, BarChart3, Users, FileText, Briefcase, ClipboardCheck, UserCog, Database, Settings2 } from 'lucide-react';

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
      { id: 'briefing' as Page, label: 'Mission Briefing', icon: <LayoutDashboard size={18} /> },
      { id: 'dashboard', label: 'Sitrep Center', icon: <BarChart3 size={18} /> },
      { id: 'communications' as Page, label: 'Comms Intercept', icon: <MessageSquare size={18} /> },
      { id: 'upload', label: 'Field Injest', icon: <Upload size={18} /> },
    ],
  },
  {
    items: [
      { id: 'client-diary' as Page, label: 'Diagnostic Feed', icon: <BookOpen size={18} /> },
      { id: 'staff-monitoring' as Page, label: 'Force Protection', icon: <Shield size={18} /> },
      { id: 'actions', label: 'Command Vectors', icon: <Zap size={18} /> },
      { id: 'incidents', label: 'Incident Govt', icon: <AlertTriangle size={18} /> },
      { id: 'staff', label: 'Personnel Ledger', icon: <Users size={18} /> },
    ],
  },
  {
    items: [
      { id: 'notes' as Page, label: 'Note Intelligence', icon: <FileText size={18} /> },
    ],
  },
  {
    items: [
      { id: 'agency' as Page, label: 'External Support', icon: <Briefcase size={18} /> },
      { id: 'compliance', label: 'Regulatory Audit', icon: <ClipboardCheck size={18} /> },
      { id: 'templates', label: 'Builder Templates', icon: <Database size={18} /> },
      { id: 'settings' as Page, label: 'System Settings', icon: <Settings2 size={18} /> },
    ],
  },
];

export function Sidebar({ page, setPage, weekData, actions, incidents, theme, setTheme, onSignOut }: Props) {
  const openActionsCount = actions.filter(a => a.status !== 'completed').length;

  return (
    <div className="w-64 h-full flex flex-col p-5 bg-hc-bg z-30 shrink-0">
      {/* Brand Header — Clay Raised */}
      <div className="hc-clay-raised p-6 mb-8 text-center flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center">
            <img src={ORG_CONFIG.logoIcon} alt="HC" className="w-7 h-7 opacity-80" />
        </div>
        <div>
          <div className="text-[10px] font-black tracking-[0.2em] uppercase text-hc-teal">Operational Core</div>
          <div className="text-[9px] font-bold text-hc-muted uppercase tracking-[0.3em] mt-0.5">{ORG_CONFIG.name}</div>
        </div>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-8 scrollbar-none">
        {navSections.map((section, idx) => (
          <div key={idx} className="space-y-1.5">
            {section.items.map((item) => (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`w-full flex items-center justify-between px-5 py-3.5 rounded-full transition-all duration-300 group
                  ${page === item.id 
                    ? 'bg-hc-teal text-white shadow-[4px_4px_10px_rgba(77,124,120,0.3)]' 
                    : 'text-hc-muted hover:text-hc-text hover:bg-hc-clay shadow-none hover:shadow-[4px_4px_8px_var(--hc-clay-dark)]'
                  }`}
              >
                <div className="flex items-center gap-4">
                  <span className={`${page === item.id ? 'text-white' : 'text-hc-teal opacity-60 group-hover:opacity-100'} transition-all`}>
                    {item.icon}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                </div>
                {item.id === 'actions' && openActionsCount > 0 && (
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black ${page === 'actions' ? 'bg-white text-hc-teal' : 'bg-hc-red text-white'}`}>
                    {openActionsCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Footer Controls — Clay Inset Group */}
      <div className="mt-auto pt-6 space-y-4">
        <div className="hc-clay-inset p-5 space-y-4">
           <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-hc-teal uppercase tracking-widest mb-1">Status</span>
                <span className="text-[10px] font-black text-hc-text uppercase tabular-nums">{weekData ? Object.values(weekData.houses).length : 0} Sites Active</span>
              </div>
              <div className="w-2 h-2 rounded-full bg-hc-green animate-pulse shadow-[0_0_8px_var(--hc-green)]" />
           </div>
           
           <div className="h-px bg-hc-clay-dark opacity-30" />
           
           <div className="flex items-center justify-between gap-2">
              <button 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="w-10 h-10 rounded-xl hc-clay-raised flex items-center justify-center text-hc-muted hover:text-hc-teal transition-all active:scale-95"
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button 
                onClick={onSignOut}
                className="flex-1 h-10 rounded-xl hc-clay-raised flex items-center justify-center gap-2 text-[9px] font-black text-hc-muted hover:text-hc-red transition-all active:scale-95 uppercase tracking-widest"
              >
                <LogOut size={14} /> Exit Core
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
