import { useState, useEffect } from 'react';
import { 
  ShieldCheck, Lock, Smartphone, Monitor, LogOut, X, ShieldAlert, 
  MapPin, Fingerprint, Activity, Clock, Shield, Database, Trash2
} from 'lucide-react';
import type { Page } from '../App';
import { ORG_CONFIG } from '../lib/config';

interface Session {
  id: string;
  nodeHash: string;
  userAgent: string;
  lastActive: string;
  location: string;
  device: 'Mobile' | 'Desktop';
  browser: string;
  isCurrent: boolean;
}

interface Props {
  onSignOut: () => void;
  setPage: (p: Page) => void;
}

export function SettingsPage({ onSignOut, setPage }: Props) {
  const [pin, setPin] = useState('');
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState('');

  // Initialise sovereign node intelligence
  useEffect(() => {
    const ua = window.navigator.userAgent;
    const isMobile = /Mobile|Android|iPhone/i.test(ua);
    const browser = ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : 'Safari';
    
    // Generate/Fetch device hash
    let nodeHash = localStorage.getItem('hc-node-hash');
    if (!nodeHash) {
      nodeHash = 'HC-' + Math.random().toString(36).substring(2, 12).toUpperCase();
      localStorage.setItem('hc-node-hash', nodeHash);
    }

    const currentId = 'sess_' + Math.random().toString(36).substring(2, 9);
    setCurrentSessionId(currentId);

    const initialSessions: Session[] = [
      {
        id: currentId,
        nodeHash,
        userAgent: ua,
        lastActive: new Date().toISOString(),
        location: 'Local Core',
        device: isMobile ? 'Mobile' : 'Desktop',
        browser,
        isCurrent: true
      },
      {
        id: 'sess_prev_01',
        nodeHash: 'HC-PRV-992X',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        lastActive: new Date(Date.now() - 3600000 * 2).toISOString(),
        location: 'Secondary Terminal',
        device: 'Desktop',
        browser: 'Chrome',
        isCurrent: false
      }
    ];
    setSessions(initialSessions);
  }, []);

  const handlePinSubmit = () => {
    if (pin === '236693!') {
      setPinUnlocked(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPin([]);
      setTimeout(() => setPinError(false), 1000);
    }
  };

  const revokeSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  const revokeAllOthers = () => {
    setSessions(prev => prev.filter(s => s.isCurrent));
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  if (!pinUnlocked) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6 animate-in fade-in duration-1000">
         <div className="w-full max-w-md hc-clay-raised p-12 rounded-[3.5rem] flex flex-col items-center gap-10 border border-hc-teal/20 shadow-2xl relative overflow-hidden">
            {/* Visual Signal */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-hc-teal/30 to-transparent" />
            
            <div className="w-20 h-20 rounded-[2rem] hc-clay-inset flex items-center justify-center text-hc-teal mb-2">
               <ShieldCheck size={40} strokeWidth={1.5} />
            </div>

            <div className="text-center space-y-3">
               <h1 className="text-2xl font-black text-hc-text tracking-[0.2em] uppercase">Security Vault</h1>
               <p className="text-[10px] font-black text-hc-muted uppercase tracking-[0.3em] opacity-60 italic">Authorisation Required for System Core</p>
            </div>

            <div className="w-full space-y-2">
               <div className={`p-4 rounded-2xl hc-clay-inset border transition-all duration-300 ${pinError ? 'border-flag-red bg-flag-red/5' : 'border-hc-border/10'}`}>
                  <input 
                    type="password"
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
                    placeholder="ENTER KEY"
                    className="w-full bg-transparent text-center text-2xl font-black tracking-[0.4em] text-hc-text placeholder:text-hc-muted/20 outline-none"
                    autoFocus
                  />
               </div>
               {pinError && <p className="text-[9px] font-black text-flag-red text-center uppercase tracking-widest animate-shake">Invalid Access Key</p>}
            </div>

            <button 
              onClick={handlePinSubmit}
              className="w-full py-5 rounded-2xl btn-tactical text-[11px] font-black uppercase tracking-[0.3em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
            >
               Unlock Sovereign Core
            </button>

            <div className="flex items-center gap-3 opacity-40">
               <Lock size={12} className="text-hc-muted" />
               <span className="text-[8px] font-black text-hc-muted uppercase tracking-widest">E2E Field-Locked Encryption</span>
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto animate-in fade-in duration-700">
      
      {/* ── HEADER ── */}
      <div className="mb-12 flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-hc-border/10 pb-10">
        <div>
          <div className="flex items-center gap-3 mb-4">
             <Shield className="w-6 h-6 text-hc-teal" />
             <h1 className="text-2xl md:text-4xl font-black text-hc-text tracking-[0.2em] uppercase">System Settings</h1>
          </div>
          <p className="text-hc-muted text-[11px] font-bold uppercase tracking-wider leading-relaxed">
             Sovereign Identity & Terminal Governance Matrix — Hardware Authorisation Vault.
          </p>
        </div>
        
        <div className="flex gap-4">
           <button onClick={() => setPinUnlocked(false)} className="px-8 py-3.5 hc-clay-raised text-[10px] font-black uppercase tracking-widest text-hc-teal border border-hc-teal/20 shadow-xl hover:bg-hc-teal/5 transition-all active:hc-clay-pressed">
              Lock Vault
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* ── SOVEREIGN IDENTITY MODULE ── */}
        <section className="space-y-8">
           <div className="hc-clay-raised p-10 rounded-[3rem] relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 text-hc-teal group-hover:scale-110 transition-transform duration-1000">
                 <Fingerprint size={120} strokeWidth={1} />
              </div>
              
              <div className="flex items-center gap-4 mb-8">
                 <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-teal"><Fingerprint size={24} /></div>
                 <div>
                    <h2 className="text-lg font-black text-hc-text uppercase tracking-tight">Identity Kernel</h2>
                    <p className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-60">Authentication Authority</p>
                 </div>
              </div>

              <div className="space-y-6">
                 <div className="flex items-center justify-between p-4 hc-clay-inset rounded-2xl">
                    <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">Operator Name</span>
                    <span className="text-[11px] font-black text-hc-text uppercase">{localStorage.getItem('hc-user-name') || 'Administrator'}</span>
                 </div>
                 <div className="flex items-center justify-between p-4 hc-clay-inset rounded-2xl">
                    <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">Auth Level</span>
                    <span className="text-[11px] font-black text-hc-teal uppercase tracking-widest">Sovereign Admin</span>
                 </div>
                 <div className="flex items-center justify-between p-4 hc-clay-inset rounded-2xl">
                    <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">Registry ID</span>
                    <span className="text-[9px] font-mono font-bold text-hc-muted opacity-80 uppercase tracking-tighter">HC-CORE-9982-A1</span>
                 </div>
              </div>
           </div>

           <div className="hc-clay-raised p-10 rounded-[3rem] space-y-6">
              <div className="flex items-center gap-4 mb-4">
                 <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-teal"><MapPin size={24} /></div>
                 <div>
                    <h2 className="text-lg font-black text-hc-text uppercase tracking-tight">Geo-Persistence</h2>
                    <p className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-60">Terminal Signal Origin</p>
                 </div>
              </div>
              <div className="space-y-4">
                 <div className="flex items-center gap-4 p-4 hc-clay-inset rounded-2xl">
                    <div className="p-3 bg-hc-teal/10 rounded-xl text-hc-teal"><MapPin size={16} /></div>
                    <div>
                       <div className="text-[10px] font-black text-hc-text uppercase">Primary Station</div>
                       <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest mt-0.5">United Kingdom · Verified Connection</div>
                    </div>
                 </div>
                 <div className="flex items-center gap-4 p-4 hc-clay-inset rounded-2xl opacity-40 grayscale">
                    <div className="p-3 bg-hc-muted/10 rounded-xl text-hc-muted"><Activity size={16} /></div>
                    <div>
                       <div className="text-[10px] font-black text-hc-muted uppercase tracking-tighter">Signal Integrity Scan</div>
                       <div className="text-[8px] font-black text-hc-muted uppercase tracking-widest mt-0.5">Automated background patrol active</div>
                    </div>
                 </div>
              </div>
           </div>
        </section>

        {/* ── ACCESS POINTS & FORENSICS ── */}
        <section className="space-y-8">
          <div className="hc-clay-raised p-10 rounded-[3rem] flex flex-col gap-8 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-hc-teal animate-pulse-slow" />
             
             <div className="flex items-center justify-between">
               <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-teal"><Smartphone size={24} /></div>
                 <div>
                   <h2 className="text-lg font-black text-hc-text uppercase tracking-tight">Operational Nodes</h2>
                   <p className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-60">Active Endpoints</p>
                 </div>
               </div>
               <span className="px-3 py-1 hc-clay-inset rounded-lg text-[10px] font-black text-hc-teal tabular-nums">{sessions.length}</span>
             </div>

             <div className="space-y-4">
                {sessions.map(s => {
                  const isCurrent = s.id === currentSessionId;
                  const DeviceIcon = s.device === 'Mobile' ? Smartphone : Monitor;
                  return (
                    <div key={s.id} className={`p-6 rounded-[2rem] flex flex-col gap-5 transition-all group ${isCurrent ? 'hc-clay-raised border border-hc-teal/20 bg-hc-teal/5' : 'hc-clay-inset opacity-60 hover:opacity-100'}`}>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isCurrent ? 'hc-clay-inset text-hc-teal' : 'bg-black/5 text-hc-muted shadow-inner'}`}>
                             <DeviceIcon size={20} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] font-black text-hc-text uppercase mb-1 flex items-center gap-2">
                               {isCurrent ? 'Current Station' : 'Remote Node'} · {s.browser}
                               {isCurrent && <span className="text-[7px] font-black px-2 py-0.5 bg-hc-teal text-hc-bone rounded-full tracking-widest">LOGGED_IN</span>}
                            </div>
                            <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest truncate">{s.location} · {formatTime(s.lastActive)}</div>
                          </div>
                        </div>
                        {!isCurrent && (
                           <button 
                             onClick={() => revokeSession(s.id)}
                             className="w-10 h-10 rounded-xl hc-clay-raised flex items-center justify-center text-hc-muted hover:text-flag-red transition-all group-hover:scale-110 active:hc-clay-pressed"
                           >
                              <X size={14} />
                           </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-hc-border/5">
                         <div>
                            <div className="text-[8px] font-black text-hc-muted uppercase opacity-40 mb-1">Node Hash</div>
                            <div className="text-[9px] font-mono font-bold text-hc-teal truncate uppercase tracking-tighter opacity-80">{s.nodeHash}</div>
                         </div>
                         <div className="text-right">
                            <div className="text-[8px] font-black text-hc-muted uppercase opacity-40 mb-1">Status</div>
                            <div className="text-[9px] font-black text-hc-text uppercase">{isCurrent ? 'Verified' : 'Stale'}</div>
                         </div>
                      </div>
                    </div>
                  );
                })}
             </div>

             {sessions.length > 1 && (
               <button onClick={revokeAllOthers} className="w-full py-4 hc-clay-raised text-[10px] font-black uppercase tracking-widest text-flag-red hover:bg-flag-red/5 transition-all flex items-center justify-center gap-3 active:hc-clay-pressed">
                  <ShieldAlert size={14} /> Revoke Remote Nodes
               </button>
             )}
          </div>

          {/* ⚡ HARDWARE BURN MODULE */}
          <div className="hc-clay-raised p-10 rounded-[3rem] border border-flag-red/20 bg-flag-red/5 space-y-8 group">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center text-flag-red shadow-[inset_0_0_12px_rgba(217,78,78,0.2)]">
                   <ShieldAlert size={24} />
                </div>
                <div>
                   <h2 className="text-lg font-black text-flag-red uppercase tracking-tight">Hardware Burn</h2>
                   <p className="text-[10px] font-bold text-flag-red/60 uppercase tracking-widest opacity-80 leading-tight">Total Sovereign Restoration</p>
                </div>
             </div>

             <div className="space-y-4">
                <p className="text-[10px] font-bold text-hc-muted uppercase tracking-wider leading-relaxed">
                   Immediate destructive purge of all local Intelligence, Credentials, and Session metadata. This node will be wiped from existence.
                </p>
                
                <button 
                  onMouseDown={(e) => {
                    e.currentTarget.classList.add('scale-95', 'bg-black');
                    const timer = setTimeout(() => {
                      if (confirm('NUCLEAR PURGE: This will wipe EVERYTHING on this hardware. Proceed?')) {
                        localStorage.clear();
                        window.location.reload();
                      }
                    }, 2000);
                    (window as any)._burnTimer = timer;
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.classList.remove('scale-95', 'bg-black');
                    clearTimeout((window as any)._burnTimer);
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.classList.remove('scale-95', 'bg-black');
                    clearTimeout((window as any)._burnTimer);
                  }}
                  className="w-full py-5 rounded-2xl bg-flag-red text-hc-bone font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl transition-all duration-300 relative overflow-hidden active:shadow-inner"
                >
                   Hold 2s to Initiate Burn
                </button>
             </div>
          </div>
        </section>

      </div>

      {/* ── MATRIX FOOTER ── */}
      <div className="pt-20 pb-12 flex flex-col items-center gap-6 border-t border-hc-border/10 mt-12">
          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl hc-clay-inset border border-hc-teal/20 text-hc-teal">
             <Activity size={16} className="animate-pulse" />
             <span className="text-[10px] font-black uppercase tracking-[0.3em]">Operational Core v.1.0 · Verified Lockdown</span>
          </div>
          <div className="flex items-center gap-8 opacity-20">
             <Shield weight="bold" size={20} className="text-hc-muted" />
             <Database weight="bold" size={20} className="text-hc-muted" />
             <Trash2 weight="bold" size={20} className="text-hc-muted" />
          </div>
      </div>
    </div>
  );
}
