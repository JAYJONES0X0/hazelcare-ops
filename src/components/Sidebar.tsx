import type { Page } from '../App';
import type { WeekSummary } from '../lib/types';

interface Props {
  page: Page;
  setPage: (p: Page) => void;
  weekData: WeekSummary | null;
}

const navItems: { id: Page; label: string; icon: string }[] = [
  { id: 'upload', label: 'Import Data', icon: '📥' },
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'templates', label: 'Templates', icon: '📋' },
  { id: 'reports', label: 'Reports', icon: '📄' },
];

export function Sidebar({ page, setPage, weekData }: Props) {
  const redFlags = weekData?.allFlags.red.length ?? 0;
  const amberFlags = weekData?.allFlags.amber.length ?? 0;

  return (
    <aside className="w-56 bg-hc-darker border-r border-hc-border flex flex-col shrink-0" style={{ background: '#0a0f1a' }}>
      {/* Logo */}
      <div className="p-4 border-b border-hc-border">
        <div className="flex items-center gap-3">
          <img src="/hazelcare-logo.png" alt="Hazelcare" className="h-8" />
          <div>
            <div className="text-sm font-bold text-white">Ops Engine</div>
            <div className="text-[10px] text-hc-muted">v2.0 — Zero Cost</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              page === item.id
                ? 'bg-hc-teal/20 text-hc-teal-light font-semibold'
                : 'text-hc-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
            {item.id === 'dashboard' && redFlags > 0 && (
              <span className="ml-auto bg-flag-red text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {redFlags}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Status */}
      <div className="p-3 border-t border-hc-border">
        {weekData ? (
          <div className="bg-hc-card rounded-lg p-3">
            <div className="text-[10px] text-hc-muted uppercase tracking-wider mb-2">This Week</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-white">{weekData.totalEntries}</div>
                <div className="text-[9px] text-hc-muted">Entries</div>
              </div>
              <div>
                <div className="text-lg font-bold text-flag-red">{redFlags}</div>
                <div className="text-[9px] text-hc-muted">Red</div>
              </div>
              <div>
                <div className="text-lg font-bold text-flag-amber">{amberFlags}</div>
                <div className="text-[9px] text-hc-muted">Amber</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-hc-muted text-center py-2">
            No data loaded.<br/>Import from Nourish to start.
          </div>
        )}
      </div>
    </aside>
  );
}
