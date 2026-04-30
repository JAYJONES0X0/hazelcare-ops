import React, { useState } from 'react';
import { 
  Shield, 
  BrainCircuit, 
  Layers, 
  BarChart3, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  FileText,
  Settings,
  Users,
  Search,
  ChevronRight,
  TrendingUp,
  Scale
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Mock Data for the Matrix (Anonymized)
const auditData = [
  { id: 'Staff YT', score: 98, status: 'Elite', insight: 'Defensive Champion' },
  { id: 'Staff PM', score: 45, status: 'At Risk', insight: 'Fragmented Narrative' },
  { id: 'Staff AA', score: 12, status: 'Critical', insight: 'High Legal Liability' },
];

const evolutionSteps = [
  {
    title: "Liability Observation",
    text: "He did not show interest.",
    flags: ["Subjective Judgment", "Zero Context", "Missing Intervention"],
    level: "Critical Fail",
    color: "red"
  },
  {
    title: "Contextual Bridge",
    text: "Staff prompted Client TA regarding personal hygiene. Client TA was sitting in the lounge and declined to engage.",
    flags: ["Chronology Present", "Specific Activity Identified"],
    level: "Basic Record",
    color: "amber"
  },
  {
    title: "Sovereign Shield",
    text: "Staff prompted Client TA regarding personal hygiene tasks (Plan 3.2). Client TA verbalized a refusal to engage. Staff assessed respiratory and physical presentation: no distress noted. Staff offered choice of alternative support (shower vs bath) to encourage engagement; refusal maintained. Autonomy respected.",
    flags: ["Clinical Assessment", "Autonomy Documented", "Plan Linked"],
    level: "Elite Standard",
    color: "emerald"
  }
];

export default function App() {
  const [activeStep, setActiveStep] = useState(0);
  const [activeTab, setActiveTab] = useState('intelligence');

  return (
    <div className="flex min-h-screen bg-hc-bone">
      {/* Tactical Sidebar */}
      <aside className="w-80 bg-hc-dark text-white p-8 flex flex-col justify-between sticky top-0 h-screen no-print">
        <div className="space-y-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-hc-teal flex items-center justify-center shadow-lg shadow-teal-500/20">
                <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-black text-xl tracking-tighter leading-none">HAZEL CARE</h1>
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-[0.3em]">Sovereign Ops</span>
            </div>
          </div>

          <nav className="space-y-2">
            {[
              { id: 'strategy', icon: BrainCircuit, label: 'Operational Strategy' },
              { id: 'intelligence', icon: Layers, label: 'Forensic Intelligence' },
              { id: 'matrix', icon: BarChart3, label: 'Performance Matrix' },
              { id: 'vault', icon: FileText, label: 'The Sovereign Vault' },
              { id: 'personnel', icon: Users, label: 'Staff Audit' },
            ].map(item => (
              <button 
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === item.id ? 'bg-hc-teal text-white shadow-xl shadow-teal-500/20 translate-x-2' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="hc-clay-inset p-6 bg-white/5 border-white/10 rounded-3xl space-y-4">
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">System Secure</span>
          </div>
          <p className="text-[9px] font-medium text-slate-500 leading-relaxed uppercase">Logged in as Administrator. All data anonymized for GDPR compliance.</p>
        </div>
      </aside>

      {/* Main Command View */}
      <main className="flex-1 p-16 max-w-6xl mx-auto space-y-24">
        
        {/* Header Header */}
        <header className="flex justify-between items-end">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-teal-500/5 border border-teal-500/20 text-hc-teal">
              <Scale className="w-3 h-3" />
              <span className="text-[9px] font-black uppercase tracking-widest">Training Protocol v4.0</span>
            </div>
            <h2 className="text-6xl font-black uppercase tracking-tighter leading-none">
              Documentation <br /> <span className="text-hc-teal italic">As A Weapon.</span>
            </h2>
          </div>
          <div className="text-right space-y-2 no-print">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Audit Readiness</span>
            <div className="text-4xl font-black text-hc-dark tabular-nums">94.8%</div>
            <div className="flex items-center gap-2 justify-end text-emerald-500">
               <TrendingUp className="w-4 h-4" />
               <span className="text-xs font-black">+12.4% Increase</span>
            </div>
          </div>
        </header>

        {/* The Evolution Engine */}
        <section className="space-y-12">
           <div className="flex items-center justify-between">
              <div className="space-y-2">
                 <h3 className="text-2xl font-black uppercase tracking-tighter">The Evolution Engine</h3>
                 <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Upgrading observations into legally defensible evidence.</p>
              </div>
              <div className="flex gap-2 no-print">
                {evolutionSteps.map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => setActiveStep(i)}
                    className={`w-12 h-1.5 rounded-full transition-all ${activeStep === i ? 'bg-hc-teal w-16' : 'bg-slate-200'}`}
                  />
                ))}
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-stretch">
              <div className="space-y-6">
                {evolutionSteps.map((step, i) => (
                  <button 
                    key={i}
                    onClick={() => setActiveStep(i)}
                    className={`w-full text-left p-10 hc-clay-raised relative overflow-hidden group ${activeStep === i ? 'border-hc-teal ring-4 ring-hc-teal/5' : 'opacity-50 hover:opacity-100'}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                       <span className={`text-[10px] font-black uppercase tracking-widest ${activeStep === i ? 'text-hc-teal' : 'text-slate-400'}`}>Step 0{i+1}</span>
                       <ChevronRight className={`w-4 h-4 transition-transform ${activeStep === i ? 'translate-x-1 text-hc-teal' : 'text-slate-300'}`} />
                    </div>
                    <h4 className="text-xl font-black uppercase tracking-tighter mb-2">{step.title}</h4>
                    <span className={`pill ${step.color === 'red' ? 'bg-red-50 text-red-600' : step.color === 'amber' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {step.level}
                    </span>
                  </button>
                ))}
              </div>

              <div className="hc-clay-raised p-12 bg-white flex flex-col justify-between border-t-8 border-hc-teal min-h-[500px]">
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={activeStep}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-12"
                  >
                    <div className="hc-clay-inset p-10 italic font-mono text-lg leading-relaxed text-slate-800 relative bg-slate-50/50">
                       <div className="absolute top-0 left-0 p-4 opacity-10">
                          <BrainCircuit className="w-12 h-12" />
                       </div>
                       "{evolutionSteps[activeStep].text}"
                    </div>
                    
                    <div className="space-y-6">
                       <h5 className="text-xs font-black uppercase text-hc-teal tracking-[0.3em]">Forensic Diagnostic</h5>
                       <ul className="space-y-4">
                          {evolutionSteps[activeStep].flags.map((flag, i) => (
                            <li key={i} className="flex items-center gap-4 group">
                               <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${evolutionSteps[activeStep].color === 'red' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                  {evolutionSteps[activeStep].color === 'red' ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                               </div>
                               <span className="text-xs font-black uppercase tracking-widest text-slate-500 group-hover:text-hc-dark transition-colors">{flag}</span>
                            </li>
                          ))}
                       </ul>
                    </div>
                  </motion.div>
                </AnimatePresence>
                <div className="pt-12 mt-auto border-t border-slate-100 flex justify-between items-center no-print">
                   <button className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-hc-teal flex items-center gap-2 transition-colors">
                      <Clock className="w-3 h-3" />
                      View Audit History
                   </button>
                   <button className="btn-tactical flex items-center gap-3">
                      Apply Standard
                      <ArrowRight className="w-4 h-4" />
                   </button>
                </div>
              </div>
           </div>
        </section>

        {/* The Forensic Matrix */}
        <section className="space-y-12">
           <div className="space-y-2">
              <h3 className="text-2xl font-black uppercase tracking-tighter text-hc-dark">The Forensic Audit Matrix</h3>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Real-time behavior tracking based on documentation integrity.</p>
           </div>

           <div className="hc-clay-raised overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="px-10 py-8 text-[10px] font-black uppercase tracking-widest text-slate-400">Personnel ID</th>
                    <th className="px-10 py-8 text-[10px] font-black uppercase tracking-widest text-slate-400">Shield Factor</th>
                    <th className="px-10 py-8 text-[10px] font-black uppercase tracking-widest text-slate-400">Diagnostic Result</th>
                    <th className="px-10 py-8 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                   {auditData.map((row) => (
                     <tr key={row.id} className="hover:bg-teal-50/20 transition-colors group">
                       <td className="px-10 py-8">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-xl hc-clay-inset flex items-center justify-center text-xs font-black text-hc-teal uppercase group-hover:scale-110 transition-transform">
                                {row.id.split(' ')[1]}
                             </div>
                             <span className="font-black uppercase tracking-tight text-hc-dark">{row.id}</span>
                          </div>
                       </td>
                       <td className="px-10 py-8">
                          <div className="flex items-center gap-4 max-w-xs">
                             <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${row.score}%` }}
                                  transition={{ duration: 1, delay: 0.5 }}
                                  className={`h-full ${row.score > 90 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : row.score > 40 ? 'bg-amber-500' : 'bg-red-500'}`} 
                                />
                             </div>
                             <span className="text-sm font-black tabular-nums tracking-tighter">{row.score}%</span>
                          </div>
                       </td>
                       <td className="px-10 py-8">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{row.insight}</span>
                       </td>
                       <td className="px-10 py-8">
                          <span className={`pill ${row.status === 'Elite' ? 'bg-emerald-50 text-emerald-600' : row.status === 'At Risk' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                             {row.status}
                          </span>
                       </td>
                     </tr>
                   ))}
                </tbody>
              </table>
           </div>
        </section>

        {/* Global Mandatory Footer */}
        <footer className="pt-24 border-t border-slate-200 flex justify-between items-center text-slate-400">
           <div className="flex items-center gap-4">
              <Shield className="w-4 h-4 text-hc-teal" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em]">Hazel Care Operational Excellence 2026</span>
           </div>
           <div className="text-[10px] font-bold uppercase tracking-widest">
              Standard: SOV-22-B
           </div>
        </footer>
      </main>
    </div>
  );
}
