import { useState } from 'react';
import type { WeekSummary } from '../lib/types';
import type { Page } from '../App';
import { ORG_CONFIG } from '../lib/config';
import { 
  FileText, 
  Download, 
  History,
  Activity,
  AlertTriangle,
  Clock,
  LayoutGrid
} from 'lucide-react';

interface Props {
  weekData: WeekSummary | null;
  setPage: (p: Page) => void;
}

type ReportType = 'weekly_summary' | 'risk_matrix' | 'entry_log' | 'staff_activity';

export function ReportsPage({ weekData }: Props) {
  const [selectedReport, setSelectedReport] = useState<ReportType>('weekly_summary');

  const REPORTS = [
    { id: 'weekly_summary', label: 'Weekly Clinical Summary', icon: Activity, desc: 'House-by-house clinical overview and flag report.' },
    { id: 'risk_matrix', label: 'CQC Risk Matrix', icon: AlertTriangle, desc: '5x5 impact/likelihood mapping for all active risks.' },
    { id: 'entry_log', label: 'Personnel Entry Log', icon: FileText, desc: 'Consolidated audit trail of all staff documentation.' },
    { id: 'staff_activity', label: 'Operational KPI Report', icon: History, desc: 'Staff quality scores, short entry ratios, and coaching events.' }
  ];

  if (!weekData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] opacity-40">
        <div className="w-16 h-16 hc-clay-raised flex items-center justify-center mb-6">
           <FileText className="w-8 h-8 text-hc-muted" />
        </div>
        <div className="text-[11px] font-black text-hc-muted uppercase tracking-[0.4em]">No clinical data loaded.</div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-[2560px] mx-auto animate-in fade-in duration-700">
      
      {/* ── Page Header ── */}
      <div className="mb-12 flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-hc-muted/10 pb-10">
        <div>
          <div className="flex items-center gap-3 mb-4">
             <LayoutGrid className="w-6 h-6 text-hc-teal" />
             <h1 className="text-2xl md:text-4xl font-black text-hc-text tracking-[0.2em] uppercase">Diagnostic Reports</h1>
          </div>
          <p className="text-hc-muted text-sm font-bold opacity-80 uppercase tracking-wider leading-relaxed">
            Clinical Data Synthesis & Export Engine — {ORG_CONFIG.name} Operational Standards.
          </p>
        </div>
        
        <div className="flex gap-3">
           <button className="px-8 py-3.5 btn-tactical shadow-2xl flex items-center gap-3">
              <Download className="w-4 h-4" /> Export Full Pack
           </button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-10">
        
        {/* Report Selection (Left) */}
        <div className="w-full xl:w-[450px] shrink-0 space-y-4">
           <div className="text-[10px] font-black text-hc-muted uppercase tracking-[0.3em] mb-6 ml-2">Available Vectors</div>
           {REPORTS.map(r => (
             <button
                key={r.id}
                onClick={() => setSelectedReport(r.id as ReportType)}
                className={`w-full text-left p-6 rounded-2xl border transition-all duration-500 group
                  ${selectedReport === r.id ? 'hc-clay-inset bg-hc-bg/50 border-hc-teal/30 scale-[1.02]' : 'hc-clay-raised border-transparent hover:border-hc-muted/20'}`}
             >
                <div className="flex items-start gap-5">
                   <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors
                     ${selectedReport === r.id ? 'bg-hc-teal text-hc-bg shadow-xl' : 'hc-clay-inset text-hc-muted group-hover:text-hc-teal'}`}>
                      <r.icon className="w-6 h-6" strokeWidth={2.5} />
                   </div>
                   <div className="min-w-0">
                      <div className={`text-sm font-black uppercase tracking-tight mb-1 transition-colors ${selectedReport === r.id ? 'text-hc-text' : 'text-hc-muted group-hover:text-hc-text'}`}>{r.label}</div>
                      <div className="text-[10px] font-bold text-hc-muted/60 leading-relaxed uppercase tracking-widest">{r.desc}</div>
                   </div>
                </div>
             </button>
           ))}
        </div>

        {/* Report Preview (Right) */}
        <div className="flex-1 min-h-[600px] hc-clay-raised overflow-hidden relative">
           <div className="absolute top-0 left-0 w-full h-1.5 bg-hc-teal" />
           <div className="p-10">
              <div className="flex items-center justify-between mb-10 pb-6 border-b border-hc-muted/10">
                 <div className="flex items-center gap-4">
                    <Clock className="w-4 h-4 text-hc-muted" />
                    <span className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em]">Live Simulation: 06/04/2026 – 16/04/2026</span>
                 </div>
                 <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl hc-clay-raised text-[10px] font-black text-hc-teal uppercase hover:scale-105 transition-all">
                    <Download className="w-3.5 h-3.5" /> PDF
                 </button>
              </div>

              {/* Mock Report Content */}
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                 <div className="grid grid-cols-2 gap-10">
                    <div className="hc-clay-inset p-8">
                       <div className="text-[9px] font-black text-hc-muted uppercase tracking-[0.3em] mb-4">Operational Summary</div>
                       <div className="text-2xl font-black text-hc-text tracking-tighter uppercase mb-2">92% Optimal</div>
                       <p className="text-[11px] text-hc-muted font-bold leading-loose uppercase tracking-widest">Network health verified across 13 stations. 2 priority escalations logged.</p>
                    </div>
                    <div className="hc-clay-inset p-8">
                       <div className="text-[9px] font-black text-hc-muted uppercase tracking-[0.3em] mb-4">Clinical Density</div>
                       <div className="text-2xl font-black text-hc-text tracking-tighter uppercase mb-2">108 Scored/Day</div>
                       <p className="text-[11px] text-hc-muted font-bold leading-loose uppercase tracking-widest">Personnel integrity standards met. 100% first-person attribution rate.</p>
                    </div>
                 </div>

                 <div className="hc-clay-raised p-8 bg-black/[0.01]">
                    <div className="flex items-center justify-between mb-6">
                       <div className="text-[10px] font-black text-hc-text uppercase tracking-[0.2em]">Regional Station Performance</div>
                       <span className="pill text-[9px]">Verified</span>
                    </div>
                    <div className="space-y-4">
                       {[
                         { house: 'Woburn House', quality: 98, flags: 0 },
                         { house: 'Station House', quality: 84, flags: 2 },
                         { house: 'Laurel House', quality: 91, flags: 1 }
                       ].map(h => (
                         <div key={h.house} className="flex items-center justify-between py-4 border-b border-hc-muted/5 last:border-0">
                            <span className="text-[11px] font-black text-hc-text uppercase tracking-widest">{h.house}</span>
                            <div className="flex items-center gap-6">
                               <div className="flex flex-col items-end">
                                  <span className="text-[10px] font-black text-hc-teal">{h.quality}%</span>
                                  <div className="h-0.5 w-16 bg-black/5 rounded-full overflow-hidden"><div className="h-full bg-hc-teal" style={{width: `${h.quality}%`}} /></div>
                               </div>
                               <span className={`text-[9px] font-black ${h.flags > 0 ? 'text-flag-red' : 'text-hc-muted opacity-30'}`}>{h.flags} Flags</span>
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>

    </div>
  );
}
