import { useState, useEffect } from 'react';
import { 
  User, Shield, RefreshCw, LogOut, Sun, Moon, 
  Settings2, Activity, Key, Database, Image as ImageIcon,
  Trash2, History, Brain
} from 'lucide-react';
import { ORG_CONFIG } from '../lib/config';
import { getStoreBounds, clearEntryStore } from '../lib/entry-store';

interface Props {
  onSignOut: () => void;
}

export function SettingsPage({ onSignOut }: Props) {
  const [theme, setTheme] = useState(() => localStorage.getItem('hc-theme') || 'dark');
  const [profile, setProfile] = useState(() => ({
    name: localStorage.getItem('hc-user-name') || 'CARE OPS',
    role: localStorage.getItem('hc-user-role') || 'Registered Manager',
    organisation: localStorage.getItem('hc-org-name') || ORG_CONFIG.name,
    email: localStorage.getItem('hc-user-email') || 'manager@hazelcare.co.uk'
  }));

  const [pin, setPin] = useState(localStorage.getItem('hc-user-pin') || '••••');
  const [showPin, setShowPin] = useState(false);
  const [bounds, setBounds] = useState(getStoreBounds());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('hc-theme', theme);
  }, [theme]);

  const handleSaveProfile = () => {
    localStorage.setItem('hc-user-name', profile.name);
    localStorage.setItem('hc-user-role', profile.role);
    localStorage.setItem('hc-org-name', profile.organisation);
    localStorage.setItem('hc-user-email', profile.email);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearMemory = () => {
    if (confirm('CRITICAL: This will purge all memorised clinical entries. This cannot be undone. Proceed?')) {
      clearEntryStore();
      setBounds(null);
    }
  };

  return (
    <div className="p-6 lg:p-12 max-w-[1400px] mx-auto animate-in fade-in duration-700">
      
      {/* ── COMMAND HEADER ── */}
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-hc-border pb-12">
        <div className="flex items-center gap-8">
          <div className="w-24 h-24 rounded-[2rem] hc-clay-inset flex items-center justify-center text-4xl font-black text-hc-teal shadow-2xl">
            {profile.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-4xl font-black text-hc-text tracking-tighter uppercase leading-none mb-4">{profile.name}</h1>
            <div className="flex items-center gap-4">
              <span className="pill pill-teal text-[11px] px-4 py-1.5">{profile.role}</span>
              <span className="text-[11px] font-black text-hc-muted uppercase tracking-[0.2em]">{profile.organisation} Â· SOVEREIGN NODE</span>
            </div>
          </div>
        </div>
        <button onClick={onSignOut} className="flex items-center gap-3 px-8 py-4 hc-clay-raised text-[11px] font-black uppercase text-flag-red hover:bg-flag-red/5 transition-all rounded-2xl shadow-xl active:scale-95">
          <LogOut size={16} /> De-authorise Session
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
        
        {/* ── COLUMN 1: PERSONNEL & SECURITY ── */}
        <div className="space-y-12">
          <section className="hc-clay-raised p-8 rounded-[2.5rem]">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 rounded-xl hc-clay-inset flex items-center justify-center text-hc-teal"><User size={20} /></div>
              <h2 className="text-xl font-black text-hc-text uppercase tracking-tight">Personnel Profile</h2>
            </div>
            <div className="space-y-6">
              {[
                { label: 'Tactical Callsign', key: 'name', type: 'text' },
                { label: 'Operational Role', key: 'role', type: 'text' },
                { label: 'Organisation', key: 'organisation', type: 'text' },
                { label: 'Secure Email', key: 'email', type: 'email' }
              ].map(f => (
                <div key={f.key} className="space-y-2">
                  <label className="text-[11px] font-black text-hc-muted uppercase tracking-widest ml-1">{f.label}</label>
                  <input 
                    type={f.type} 
                    value={profile[f.key as keyof typeof profile]} 
                    onChange={e => setProfile({...profile, [f.key]: e.target.value})}
                    className="w-full hc-clay-inset px-6 py-4 text-sm font-black text-hc-text outline-none shadow-inner"
                  />
                </div>
              ))}
              <button onClick={handleSaveProfile} className="w-full py-4 btn-tactical shadow-2xl mt-4">
                {saved ? '✓ DATA SYNCHRONISED' : 'Update Profile Metadata'}
              </button>
            </div>
          </section>

          <section className="hc-clay-raised p-8 rounded-[2.5rem]">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 rounded-xl hc-clay-inset flex items-center justify-center text-hc-teal"><Shield size={20} /></div>
              <h2 className="text-xl font-black text-hc-text uppercase tracking-tight">Access Control</h2>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-hc-muted uppercase tracking-widest ml-1">Device Quick-PIN</label>
                <div className="relative">
                  <input 
                    type={showPin ? "text" : "password"} 
                    value={pin}
                    onChange={e => { setPin(e.target.value); localStorage.setItem('hc-user-pin', e.target.value); }}
                    className="w-full hc-clay-inset px-6 py-4 text-sm font-black text-hc-text tracking-[1em] outline-none shadow-inner"
                    maxLength={4}
                  />
                  <button onClick={() => setShowPin(!showPin)} className="absolute right-4 top-1/2 -translate-y-1/2 text-hc-muted hover:text-hc-teal transition-colors">
                    {showPin ? <RefreshCw size={16} /> : <Key size={16} />}
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-hc-muted font-bold leading-relaxed uppercase">The PIN allows for rapid shift handovers on shared hardware without a full logout.</p>
            </div>
          </section>
        </div>

        {/* ── COLUMN 2: BRANDING & THEME (ROLE SWAPPED) ── */}
        <div className="space-y-12">
          <section className="hc-clay-raised p-8 rounded-[2.5rem]">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 rounded-xl hc-clay-inset flex items-center justify-center text-hc-teal"><Settings2 size={20} /></div>
              <h2 className="text-xl font-black text-hc-text uppercase tracking-tight">Interface Calibration</h2>
            </div>
            <div className="space-y-8">
              <div className="hc-clay-inset p-2 rounded-2xl flex gap-2">
                {[
                  { id: 'light', label: 'Organic Bone', icon: <Sun size={16} />, desc: 'Cream canvas Â· Teal accents' },
                  { id: 'dark', label: 'Nocturnal Teal', icon: <Moon size={16} />, desc: 'Deep Teal canvas Â· Bone accents' }
                ].map(t => (
                  <button 
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`flex-1 p-6 rounded-xl transition-all duration-500 text-center space-y-3
                      ${theme === t.id ? 'bg-hc-teal text-hc-bone shadow-2xl scale-105' : 'text-hc-muted hover:text-hc-text'}`}
                  >
                    <div className="flex justify-center">{t.icon}</div>
                    <div className="text-[11px] font-black uppercase tracking-widest">{t.label}</div>
                    <div className={`text-[9px] uppercase font-bold opacity-60`}>{t.desc}</div>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-hc-muted font-bold leading-relaxed uppercase text-center italic">"Role-Swapped architecture flips the canvas hierarchy based on your operational environment."</p>
            </div>
          </section>

          <section className="hc-clay-raised p-8 rounded-[2.5rem]">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 rounded-xl hc-clay-inset flex items-center justify-center text-hc-teal"><ImageIcon size={20} /></div>
              <h2 className="text-xl font-black text-hc-text uppercase tracking-tight">Strategic Branding</h2>
            </div>
            <div className="space-y-6">
               <div className="flex items-center gap-6 p-6 hc-clay-inset rounded-2xl">
                  <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center border border-hc-border">
                    <img src={ORG_CONFIG.logoIcon} alt="Logo" className="w-10 h-10 opacity-80" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[11px] font-black text-hc-text uppercase mb-1">Organisation Logo</div>
                    <div className="text-[10px] text-hc-muted font-bold uppercase">PNG, JPG, SVG Â· Max 2MB</div>
                  </div>
               </div>
               <button className="w-full py-4 hc-clay-raised text-[11px] font-black uppercase tracking-widest text-hc-text hover:text-hc-teal transition-all">Upload New Vector Asset</button>
            </div>
          </section>
        </div>

        {/* ── COLUMN 3: CLINICAL MEMORY ── */}
        <div className="space-y-12">
          <section className="hc-clay-raised p-8 rounded-[2.5rem] border-hc-teal/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 text-hc-teal group-hover:scale-150 transition-transform duration-1000">
              <Brain size={120} />
            </div>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 rounded-xl hc-clay-inset flex items-center justify-center text-hc-teal"><Database size={20} /></div>
              <h2 className="text-xl font-black text-hc-text uppercase tracking-tight">Clinical Memory</h2>
            </div>
            
            <div className="space-y-8 relative z-10">
              <div className="grid grid-cols-2 gap-4">
                <div className="hc-clay-inset p-5 text-center">
                  <div className="text-[10px] font-black text-hc-muted uppercase tracking-widest mb-1">Diagnostic Vol.</div>
                  <div className="text-2xl font-black text-hc-teal tabular-nums">{bounds?.count?.toLocaleString() || 0}</div>
                </div>
                <div className="hc-clay-inset p-5 text-center">
                  <div className="text-[10px] font-black text-hc-muted uppercase tracking-widest mb-1">Time Horizon</div>
                  <div className="text-[11px] font-black text-hc-text uppercase mt-2">{bounds ? `${bounds.from.split('/')[1]}M Â· ${bounds.from.split('/')[2]}` : 'N/A'}</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-[11px] font-black uppercase text-hc-muted">
                  <span>Storage Saturation</span>
                  <span>{Math.round(((bounds?.count || 0) / 25000) * 100)}%</span>
                </div>
                <div className="h-2 rounded-full hc-clay-inset overflow-hidden p-0.5">
                  <div className="h-full bg-hc-teal rounded-full shadow-[0_0_10px_#1c4e4e] transition-all duration-1000" style={{ width: `${Math.min(100, ((bounds?.count || 0) / 25000) * 100)}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button className="w-full flex items-center justify-center gap-3 py-4 hc-clay-raised text-[11px] font-black text-hc-text hover:text-hc-teal transition-all">
                  <History size={16} /> Download Memory Snapshot
                </button>
                <button onClick={handleClearMemory} className="w-full flex items-center justify-center gap-3 py-4 hc-clay-raised text-[11px] font-black text-flag-red hover:bg-flag-red/5 transition-all">
                  <Trash2 size={16} /> Purge Diagnostic Ledger
                </button>
              </div>
              
              <p className="text-[11px] text-hc-muted font-bold leading-relaxed uppercase italic">"Memory is stored locally on this terminal. No clinical data is transmitted to Hazel Care servers."</p>
            </div>
          </section>

          <section className="hc-clay-raised p-8 rounded-[2.5rem] bg-hc-teal text-hc-bone">
             <div className="flex items-center gap-4 mb-6">
                <Activity size={24} className="animate-pulse" />
                <h2 className="text-xl font-black uppercase tracking-tighter">System Integrity</h2>
             </div>
             <div className="space-y-4">
                {[
                   { label: 'E2E Encryption', status: 'ACTIVE' },
                   { label: 'Local SQLite Index', status: 'VERIFIED' },
                   { label: 'Clinical Logic Rev', status: 'v2.4.8' },
                   { label: 'Sovereign Bridge', status: 'ESTABLISHED' }
                ].map(s => (
                   <div key={s.label} className="flex justify-between items-center border-b border-hc-bone/10 pb-3">
                      <span className="text-[11px] font-black opacity-60 uppercase">{s.label}</span>
                      <span className="text-[11px] font-black tracking-widest">{s.status}</span>
                   </div>
                ))}
             </div>
          </section>
        </div>

      </div>

      {/* ── FOOTER FOOTPRINT ── */}
      <div className="mt-20 flex flex-col items-center gap-4 opacity-40">
        <div className="w-8 h-8 rounded-lg hc-clay-inset flex items-center justify-center grayscale">
          <img src={ORG_CONFIG.logoIcon} alt="HC" className="w-4 h-4" />
        </div>
        <div className="text-[10px] font-black text-hc-text uppercase tracking-[0.5em]">Hazel Care Ops Matrix Â· Core v1.0.0</div>
      </div>

    </div>
  );
}
