import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';

interface Option { value: string; label: string }

export function SearchSelect({ options, value, onChange, placeholder, className, allowCustom, onAddCustom }: { options: Option[]; value: string; onChange: (value: string) => void; placeholder?: string; className?: string; allowCustom?: boolean; onAddCustom?: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = options.find(o => o.value === value);

  const filtered = query
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        o.value.toLowerCase().includes(query.toLowerCase())
      )
    : options;

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={containerRef} className={`relative min-w-[140px] ${className || ''}`}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 hc-clay-inset px-4 py-3 sm:px-6 sm:py-4 text-sm font-black text-hc-text outline-none shadow-inner rounded-xl"
      >
        <span className="truncate flex-1 text-left">{current?.label || placeholder || 'Select...'}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-hc-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 hc-clay-raised-high bg-hc-surface p-2 z-50 animate-in zoom-in-95 duration-200 shadow-3xl max-h-[280px] flex flex-col">
          <div className="relative mb-1 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-hc-muted" />
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search..." autoComplete="off"
              className="w-full hc-clay-inset pl-9 pr-3 py-2.5 rounded-xl text-[11px] font-bold text-hc-text outline-none"
            />
          </div>
          <div className="overflow-y-auto flex-1 space-y-0.5 scrollbar-thin">
            {filtered.map(opt => (
              <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false); setQuery(''); }}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-[10px] font-bold transition-colors hover:bg-hc-teal/5 ${
                  opt.value === value ? 'bg-hc-teal/10 text-hc-teal font-black' : 'text-hc-text'
                }`}
              >
                {opt.label}
              </button>
            ))}
            {filtered.length === 0 && !allowCustom && (
              <p className="px-3 py-4 text-[10px] text-hc-muted text-center font-bold">No matches</p>
            )}
            {allowCustom && query.trim() && !options.some(o => o.value.toLowerCase() === query.trim().toLowerCase()) && (
              <button type="button"
                onClick={() => { const v = query.trim(); onAddCustom?.(v); onChange(v); setOpen(false); setQuery(''); }}
                className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-hc-teal bg-hc-teal/10 hover:bg-hc-teal/20"
              >
                + Add "{query.trim()}"
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
