import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { getStoreBounds } from '../lib/entry-store';

export interface DateRange {
  from: string | null; // DD/MM/YYYY
  to: string | null;
}

export type RangePreset = 'all' | 'today' | 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'custom';

function toddmmyyyy(d: Date): string {
  return [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    d.getFullYear(),
  ].join('/');
}

function getPresetRange(preset: RangePreset): DateRange {
  const now = new Date();
  if (preset === 'all' || preset === 'custom') return { from: null, to: null };
  if (preset === 'today') {
    const t = toddmmyyyy(now);
    return { from: t, to: t };
  }
  if (preset === 'this-week') {
    const dow = now.getDay() || 7;
    const mon = new Date(now); mon.setDate(now.getDate() - dow + 1);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { from: toddmmyyyy(mon), to: toddmmyyyy(sun) };
  }
  if (preset === 'last-week') {
    const dow = now.getDay() || 7;
    const lastMon = new Date(now); lastMon.setDate(now.getDate() - dow - 6);
    const lastSun = new Date(lastMon); lastSun.setDate(lastMon.getDate() + 6);
    return { from: toddmmyyyy(lastMon), to: toddmmyyyy(lastSun) };
  }
  if (preset === 'this-month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: toddmmyyyy(first), to: toddmmyyyy(last) };
  }
  if (preset === 'last-month') {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: toddmmyyyy(first), to: toddmmyyyy(last) };
  }
  return { from: null, to: null };
}

function toInputVal(s: string | null): string {
  if (!s) return '';
  const p = s.split('/');
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : '';
}

function fromInputVal(s: string): string {
  if (!s) return '';
  const p = s.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : '';
}

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: 'all',        label: 'All Time' },
  { id: 'this-week',  label: 'This Week' },
  { id: 'last-week',  label: 'Last Week' },
  { id: 'this-month', label: 'This Month' },
  { id: 'last-month', label: 'Last Month' },
  { id: 'custom',     label: 'Custom' },
];

interface Props {
  range: DateRange;
  onChange: (r: DateRange) => void;
  entryCount?: number;
  compact?: boolean;
}

export function DateRangePicker({ range, onChange, entryCount, compact }: Props) {
  const [activePreset, setActivePreset] = useState<RangePreset>('all');
  const bounds = getStoreBounds();

  const applyPreset = (preset: RangePreset) => {
    setActivePreset(preset);
    if (preset !== 'custom') onChange(getPresetRange(preset));
  };

  return (
    <div className={`hc-clay-raised rounded-2xl flex flex-wrap items-center gap-3 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center gap-2 shrink-0">
        <Calendar className="w-4 h-4 text-hc-teal" />
        {!compact && (
          <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">Time Range</span>
        )}
        {bounds && !compact && (
          <span className="text-[9px] font-black text-hc-muted/50 uppercase">
            · {bounds.count.toLocaleString()} entries · {bounds.from} → {bounds.to}
          </span>
        )}
        {bounds && compact && (
          <span className="text-[9px] font-black text-hc-muted/50 tabular-nums">{bounds.count.toLocaleString()} stored</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => applyPreset(p.id)}
            className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl transition-all ${
              activePreset === p.id
                ? 'bg-hc-teal text-hc-bone shadow-md'
                : 'hc-clay-inset text-hc-muted hover:text-hc-text'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {activePreset === 'custom' && (
        <div className="flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
          <input
            type="date"
            value={toInputVal(range.from)}
            onChange={e => onChange({ ...range, from: fromInputVal(e.target.value) })}
            className="hc-clay-inset rounded-xl px-3 py-1.5 text-[10px] font-black text-hc-text focus:outline-none"
          />
          <span className="text-hc-muted text-[10px] font-black">→</span>
          <input
            type="date"
            value={toInputVal(range.to)}
            onChange={e => onChange({ ...range, to: fromInputVal(e.target.value) })}
            className="hc-clay-inset rounded-xl px-3 py-1.5 text-[10px] font-black text-hc-text focus:outline-none"
          />
        </div>
      )}

      {entryCount !== undefined && (
        <div className="ml-auto flex items-center gap-2 hc-clay-inset rounded-xl px-4 py-2">
          <div className="w-1.5 h-1.5 rounded-full bg-hc-teal animate-pulse" />
          <span className="text-[10px] font-black text-hc-text tabular-nums">
            {entryCount.toLocaleString()} in range
          </span>
        </div>
      )}
    </div>
  );
}
