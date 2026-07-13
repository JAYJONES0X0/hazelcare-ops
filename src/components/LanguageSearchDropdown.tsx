import { useState, useRef, useEffect } from 'react';
import { Search, Globe2, ChevronDown } from 'lucide-react';

const LANGUAGES = [
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-IE', label: 'English (Ireland)' },
  { code: 'en-AU', label: 'English (Australia)' },
  { code: 'fr-FR', label: 'French' },
  { code: 'es-ES', label: 'Spanish' },
  { code: 'de-DE', label: 'German' },
  { code: 'it-IT', label: 'Italian' },
  { code: 'pt-PT', label: 'Portuguese' },
  { code: 'nl-NL', label: 'Dutch' },
  { code: 'sv-SE', label: 'Swedish' },
  { code: 'da-DK', label: 'Danish' },
  { code: 'nb-NO', label: 'Norwegian' },
  { code: 'fi-FI', label: 'Finnish' },
  { code: 'pl-PL', label: 'Polish' },
  { code: 'cs-CZ', label: 'Czech' },
  { code: 'sk-SK', label: 'Slovak' },
  { code: 'hu-HU', label: 'Hungarian' },
  { code: 'ro-RO', label: 'Romanian' },
  { code: 'bg-BG', label: 'Bulgarian' },
  { code: 'sr-RS', label: 'Serbian' },
  { code: 'hr-HR', label: 'Croatian' },
  { code: 'sl-SI', label: 'Slovenian' },
  { code: 'et-EE', label: 'Estonian' },
  { code: 'lv-LV', label: 'Latvian' },
  { code: 'lt-LT', label: 'Lithuanian' },
  { code: 'el-GR', label: 'Greek' },
  { code: 'he-IL', label: 'Hebrew' },
  { code: 'uk-UA', label: 'Ukrainian' },
  { code: 'ru-RU', label: 'Russian' },
  { code: 'tr-TR', label: 'Turkish' },
  { code: 'ca-ES', label: 'Catalan' },
  { code: 'ar-SA', label: 'Arabic' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'bn-BD', label: 'Bengali (Bangladesh)' },
  { code: 'bn-IN', label: 'Bengali (India)' },
  { code: 'ur-PK', label: 'Urdu' },
  { code: 'pa-IN', label: 'Punjabi' },
  { code: 'gu-IN', label: 'Gujarati' },
  { code: 'mr-IN', label: 'Marathi' },
  { code: 'or-IN', label: 'Odia' },
  { code: 'ta-IN', label: 'Tamil' },
  { code: 'te-IN', label: 'Telugu' },
  { code: 'kn-IN', label: 'Kannada' },
  { code: 'ml-IN', label: 'Malayalam' },
  { code: 'si-LK', label: 'Sinhala' },
  { code: 'ne-NP', label: 'Nepali' },
  { code: 'my-MM', label: 'Burmese' },
  { code: 'km-KH', label: 'Khmer' },
  { code: 'lo-LA', label: 'Lao' },
  { code: 'th-TH', label: 'Thai' },
  { code: 'vi-VN', label: 'Vietnamese' },
  { code: 'id-ID', label: 'Indonesian' },
  { code: 'ms-MY', label: 'Malay' },
  { code: 'tl-PH', label: 'Filipino' },
  { code: 'kk-KZ', label: 'Kazakh' },
  { code: 'uz-UZ', label: 'Uzbek' },
  { code: 'ka-GE', label: 'Georgian' },
  { code: 'hy-AM', label: 'Armenian' },
  { code: 'az-AZ', label: 'Azerbaijani' },
  { code: 'mn-MN', label: 'Mongolian' },
  { code: 'am-ET', label: 'Amharic' },
  { code: 'ha-NG', label: 'Hausa' },
  { code: 'so-SO', label: 'Somali' },
  { code: 'sw-KE', label: 'Swahili' },
  { code: 'zu-ZA', label: 'Zulu' },
  { code: 'xh-ZA', label: 'Xhosa' },
  { code: 'af-ZA', label: 'Afrikaans' },
  { code: 'rw-RW', label: 'Kinyarwanda' },
  { code: 'ig-NG', label: 'Igbo' },
  { code: 'yo-NG', label: 'Yoruba' },
  { code: 'sn-ZW', label: 'Shona' },
];

export function LanguageSearchDropdown({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find(l => l.code === value);
  const customMode = !current && value;

  const filtered = query
    ? LANGUAGES.filter(l =>
        l.code.toLowerCase().includes(query.toLowerCase()) ||
        l.label.toLowerCase().includes(query.toLowerCase())
      )
    : LANGUAGES;

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
    <div ref={containerRef} className="relative min-w-[140px]">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 hc-clay-inset px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-hc-text"
      >
        <Globe2 className="w-3.5 h-3.5 text-hc-teal shrink-0" />
        <span className="truncate flex-1 text-left">
          {customMode ? value : current ? `${current.code.split('-')[0].toUpperCase()} ${current.label}` : 'Language'}
        </span>
        <ChevronDown className={`w-3 h-3 text-hc-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 sm:left-auto sm:right-0 top-12 w-[min(18rem,calc(100vw-2rem))] hc-clay-raised-high bg-hc-surface p-2 z-50 animate-in zoom-in-95 duration-200 shadow-3xl max-h-[320px] flex flex-col">
          <div className="relative mb-1 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-hc-muted" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search language or type code..."
              className="w-full hc-clay-inset pl-9 pr-3 py-2.5 rounded-xl text-[11px] font-bold text-hc-text outline-none"
            />
          </div>

          <div className="overflow-y-auto flex-1 space-y-0.5 scrollbar-thin">
            {customMode && (
              <button
                type="button"
                onClick={() => { setOpen(false); setQuery(''); }}
                className="w-full text-left px-3 py-2.5 rounded-xl bg-hc-teal/10 text-[10px] font-black text-hc-teal uppercase tracking-widest"
              >
                {value}
              </button>
            )}
            {filtered.map(lang => (
              <button
                key={lang.code}
                type="button"
                onClick={() => { onChange(lang.code); setOpen(false); setQuery(''); }}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-[10px] font-bold transition-colors hover:bg-hc-teal/5 ${
                  lang.code === value ? 'bg-hc-teal/10 text-hc-teal font-black' : 'text-hc-text'
                }`}
              >
                <span className="uppercase tracking-widest mr-2 opacity-60">{lang.code.split('-')[0]}</span>
                {lang.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center">
                <p className="text-[10px] font-bold text-hc-muted mb-2">No match found. Tap to use custom code:</p>
                <button
                  type="button"
                  onClick={() => { onChange(query); setOpen(false); setQuery(''); }}
                  className="px-4 py-2 rounded-xl bg-hc-teal/10 text-[10px] font-black text-hc-teal uppercase tracking-widest"
                >
                  Use "{query}"
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
