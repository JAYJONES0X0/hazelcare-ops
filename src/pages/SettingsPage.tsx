import { useState, useEffect, useRef } from 'react';
import {
  User, Shield, LogOut, Sun, Moon,
  Activity, Key, Upload,
  Trash2, History, Brain, Monitor, Smartphone, Globe, X, Lock,
  Sliders, Eye, Cpu, Gauge, Zap, AlertCircle, Terminal, HardDrive,
  Layers, ShieldAlert, Clock
} from 'lucide-react';
import { ORG_CONFIG } from '../lib/config';
import { getStoreBoundsAsync, clearEntryStore } from '../lib/entry-store';

interface StoredSession {
  id: string;
  device: string;
  browser: string;
  timestamp: string;
  lastActive: string;
  revoked: boolean;
}

interface AuditLog {
  id: string;
  event: string;
  timestamp: string;
  type: 'Injest' | 'Synthesis' | 'Access';
}

interface Props {
  onSignOut: () => void;
}

export function SettingsPage({ onSignOut }: Props) {
  // PIN gate — stays unlocked for the session once correct PIN entered
  const [pinUnlocked, setPinUnlocked] = useState(() => {
    const savedPin = localStorage.getItem('hc-access-pin');
    if (!savedPin) return true;
    return sessionStorage.getItem('hc-pin-unlocked') === 'true';
  });
  const [pinInput, setPinInput] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState(false);
  const pinRef0 = useRef<HTMLInputElement>(null);
  const pinRef1 = useRef<HTMLInputElement>(null);
  const pinRef2 = useRef<HTMLInputElement>(null);
  const pinRef3 = useRef<HTMLInputElement>(null);
  const pinRefs = [pinRef0, pinRef1, pinRef2, pinRef3];

  const [theme, setTheme] = useState(() => localStorage.getItem('hc-theme') || 'dark');
  
  // Module A: Identity Core
  const [profile, setProfile] = useState(() => ({
    name: localStorage.getItem('hc-user-name') || 'CARE OPS',
    role: localStorage.getItem('hc-user-role') || 'Registered Manager',
    organisation: localStorage.getItem('hc-org-name') || ORG_CONFIG.name,
    email: localStorage.getItem('hc-user-email') || 'manager@hazelcare.co.uk'
  }));

  // Module B: Clinical Logic Calibration
  const [logic, setLogic] = useState(() => ({
    sensitivity: Number(localStorage.getItem('hc-ai-sensitivity')) || 75,
    forensicVerbosity: localStorage.getItem('hc-forensic-verbosity') === 'true'
  }));

  // Module C: UI Hardware Tuning
  const [ui, setUi] = useState(() => ({
    compactDensity: localStorage.getItem('hc-compact-density') === 'true',
    shadowDepth: Number(localStorage.getItem('hc-shadow-depth')) || 3
  }));

  // Module D: Forensic Security
  const [security, setSecurity] = useState(() => ({
    accessPin: localStorage.getItem('hc-access-pin') || '',
    sessionExpiry: localStorage.getItem('hc-session-expiry') || 'secure'
  }));

  const [showPin, setShowPin] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [bounds, setBounds] = useState<{ count: number; from: string | null; to: string | null } | null>(null);

  useEffect(() => {
    void getStoreBoundsAsync().then(b => setBounds(b as any));
  }, []);
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const currentSessionId = sessionStorage.getItem('hc-session-id') || '';

  // Module E: System Matrix Ledger (Mocked or from Storage)
  const [auditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('hc-audit-log');
    if (saved) return JSON.parse(saved);
    return [
      { id: '1', event: 'System Injest: Staff Note #442', timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), type: 'Injest' },
      { id: '2', event: 'Synthesis: Risk Matrix Calibration', timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), type: 'Synthesis' },
      { id: '3', event: 'Access: Personnel Ledger Decrypt', timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), type: 'Access' },
      { id: '4', event: 'System Injest: Handover Packet @22:00', timestamp: new Date(Date.now() - 1000 * 3600 * 2).toISOString(), type: 'Injest' },
      { id: '5', event: 'Access: Core Settings Modification', timestamp: new Date(Date.now() - 1000 * 3600 * 4).toISOString(), type: 'Access' },
    ];
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('hc-theme', theme);
  }, [theme]);

  useEffect(() => {
    const raw = localStorage.getItem('hc-registered-sessions');
    const all: StoredSession[] = raw ? JSON.parse(raw) : [];
    setSessions(all.filter(s => !s.revoked));
  }, [pinUnlocked]);

  // Persist Logic Calibration
  useEffect(() => {
    localStorage.setItem('hc-ai-sensitivity', String(logic.sensitivity));
    localStorage.setItem('hc-forensic-verbosity', String(logic.forensicVerbosity));
  }, [logic]);

  // Persist UI Tuning
  useEffect(() => {
    localStorage.setItem('hc-compact-density', String(ui.compactDensity));
    localStorage.setItem('hc-shadow-depth', String(ui.shadowDepth));
    document.documentElement.classList.toggle('compact-density', ui.compactDensity);
    document.documentElement.style.setProperty('--shadow-depth', String(ui.shadowDepth / 3));
  }, [ui]);

  // Persist Security
  useEffect(() => {
    localStorage.setItem('hc-session-expiry', security.sessionExpiry);
  }, [security.sessionExpiry]);

  const handlePinDigit = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...pinInput];
    next[idx] = val;
    setPinInput(next);
    setPinError(false);
    if (val && idx < 3) pinRefs[idx + 1].current?.focus();
    if (val && idx === 3) {
      const entered = next.join('');
      const stored = localStorage.getItem('hc-access-pin') || '';
      if (entered === stored) {
        sessionStorage.setItem('hc-pin-unlocked', 'true');
        setPinUnlocked(true);
      } else {
        setPinError(true);
        setPinInput(['', '', '', '']);
        setTimeout(() => pinRefs[0].current?.focus(), 80);
      }
    }
  };

  const handlePinKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pinInput[idx] && idx > 0) {
      pinRefs[idx - 1].current?.focus();
    }
  };

  const handleSaveProfile = () => {
    localStorage.setItem('hc-user-name', profile.name);
    localStorage.setItem('hc-user-role', profile.role);
    localStorage.setItem('hc-org-name', profile.organisation);
    localStorage.setItem('hc-user-email', profile.email);
    setSaved('profile');
    setTimeout(() => setSaved(null), 2000);
  };

  const handleSavePin = () => {
    if (security.accessPin === '') {
      localStorage.removeItem('hc-access-pin');
      sessionStorage.removeItem('hc-pin-unlocked');
    } else if (security.accessPin.length === 4) {
      localStorage.setItem('hc-access-pin', security.accessPin);
      sessionStorage.setItem('hc-pin-unlocked', 'true');
    }
    setSaved('pin');
    setTimeout(() => setSaved(null), 2000);
  };

  const handleClearMemory = () => {
    if (confirm('CRITICAL: This will purge all memorised clinical entries. This cannot be undone. Proceed?')) {
      clearEntryStore();
      setBounds(null);
    }
  };

  const revokeSession = (id: string) => {
    const all: StoredSession[] = JSON.parse(localStorage.getItem('hc-registered-sessions') || '[]');
    const updated = all.map(s => s.id === id ? { ...s, revoked: true } : s);
    localStorage.setItem('hc-registered-sessions', JSON.stringify(updated));
    setSessions(updated.filter(s => !s.revoked));
  };

  const revokeAllOthers = () => {
    const all: StoredSession[] = JSON.parse(localStorage.getItem('hc-registered-sessions') || '[]');
    const updated = all.map(s => s.id === currentSessionId ? s : { ...s, revoked: true });
    localStorage.setItem('hc-registered-sessions', JSON.stringify(updated));
    setSessions(updated.filter(s => !s.revoked));
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  // ── PIN GATE OVERLAY ──
  if (!pinUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hc-bg p-6">
        <div className="hc-clay-raised p-12 rounded-[3rem] w-full max-w-sm flex flex-col items-center gap-8 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-teal">
            <Lock size={28} />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-hc-text uppercase tracking-tighter mb-2">Restricted Access</h2>
            <p className="text-[10px] font-black text-hc-muted uppercase tracking-widest">Enter 4-digit PIN to access System Settings</p>
          </div>
          <div className="flex gap-3">
            {pinInput.map((digit, i) => (
              <input
                key={i}
                ref={pinRefs[i]}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handlePinDigit(i, e.target.value)}
                onKeyDown={e => handlePinKeyDown(i, e)}
                autoFocus={i === 0}
                className={`w-14 h-14 text-center text-2xl font-black hc-clay-inset outline-none transition-all rounded-2xl
                  ${pinError ? 'ring-2 ring-flag-red text-flag-red' : digit ? 'text-hc-teal' : 'text-hc-muted'}`}
              />
            ))}
          </div>
          {pinError && (
            <p className="text-[10px] font-black text-flag-red uppercase tracking-widest -mt-4">Incorrect PIN · Try again</p>
          )}
          <p className="text-[9px] font-black text-hc-muted uppercase tracking-widest opacity-50 text-center">PIN configured in Access Control · Clears on sign-out or refresh</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto animate-in fade-in duration-700 space-y-8">

      {/* ── SOVEREIGN HEADER ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 hc-clay-raised p-8 rounded-[3rem] border border-hc-teal/10">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-[2rem] hc-clay-inset flex items-center justify-center text-3xl font-black text-hc-teal relative group overflow-hidden">
            <div className="absolute inset-0 bg-hc-teal/5 animate-pulse" />
            <span className="relative z-10">{profile.name.charAt(0)}</span>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-[10px] font-black text-hc-teal uppercase tracking-[0.3em]">Sovereign Node Activated</span>
              <div className="w-2 h-2 rounded-full bg-hc-green animate-pulse shadow-[0_0_8px_var(--hc-green)]" />
            </div>
            <h1 className="text-3xl font-black text-hc-text tracking-tighter uppercase leading-none">{profile.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="px-3 py-1 hc-clay-raised text-[9px] font-black text-hc-muted uppercase tracking-widest rounded-lg">{profile.role}</span>
              <span className="text-[10px] font-bold text-hc-muted/60 uppercase tracking-widest">{profile.organisation}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-14 h-14 rounded-2xl hc-clay-raised flex items-center justify-center text-hc-text hover:text-hc-teal transition-all active:hc-clay-pressed"
           >
             {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
           </button>
           <button onClick={onSignOut} className="flex items-center gap-3 px-8 h-14 hc-clay-raised text-[10px] font-black uppercase text-flag-red hover:bg-flag-red/5 transition-all rounded-2xl active:hc-clay-pressed group">
            <LogOut size={16} className="group-hover:translate-x-1 transition-transform" /> De-authorise Node
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">

        {/* ── MODULE A: IDENTITY CORE ── */}
        <section className="hc-clay-raised p-8 rounded-[2.5rem] flex flex-col gap-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-teal"><User size={24} /></div>
            <div>
              <h2 className="text-lg font-black text-hc-text uppercase tracking-tight">Identity Core</h2>
              <p className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-60">Authentication Metadata</p>
            </div>
          </div>
          <div className="space-y-5">
            {[
              { label: 'Tactical Callsign', key: 'name', type: 'text', icon: <Terminal size={14}/> },
              { label: 'Operational Role', key: 'role', type: 'text', icon: <Shield size={14}/> },
              { label: 'Organisation', key: 'organisation', type: 'text', icon: <Globe size={14}/> },
              { label: 'Secure Email', key: 'email', type: 'email', icon: <X size={14}/> }
            ].map(f => (
              <div key={f.key} className="space-y-2">
                <label className="text-[10px] font-black text-hc-muted uppercase tracking-widest ml-1 flex items-center gap-2">
                   {f.icon} {f.label}
                </label>
                <input
                  type={f.type}
                  value={profile[f.key as keyof typeof profile]}
                  onChange={e => setProfile({ ...profile, [f.key]: e.target.value })}
                  className="w-full hc-clay-inset px-6 py-4 text-sm font-black text-hc-text outline-none focus:ring-2 focus:ring-hc-teal/20 transition-all rounded-2xl"
                />
              </div>
            ))}
            <button 
              onClick={handleSaveProfile} 
              className={`w-full py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all active:hc-clay-pressed shadow-xl
                ${saved === 'profile' ? 'bg-hc-teal text-hc-bone' : 'hc-clay-raised text-hc-text hover:text-hc-teal'}`}
            >
              {saved === 'profile' ? '✓ Data Synchronised' : 'Sync Identity Matrix'}
            </button>
          </div>
        </section>

        {/* ── MODULE B: CLINICAL LOGIC CALIBRATION ── */}
        <section className="hc-clay-raised p-8 rounded-[2.5rem] flex flex-col gap-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-teal"><Cpu size={24} /></div>
            <div>
              <h2 className="text-lg font-black text-hc-text uppercase tracking-tight">Clinical Logic</h2>
              <p className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-60">AI Intelligence Tuning</p>
            </div>
          </div>
          
          <div className="space-y-10">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-hc-muted uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Sliders size={14}/> Sensitivity Slider
                </label>
                <span className="text-[11px] font-black text-hc-teal tabular-nums">{logic.sensitivity}% Strict</span>
              </div>
              <div className="px-2">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={logic.sensitivity}
                  onChange={e => setLogic({ ...logic, sensitivity: Number(e.target.value) })}
                  className="w-full h-2 rounded-full hc-clay-inset appearance-none cursor-pointer accent-hc-teal"
                />
              </div>
              <p className="text-[9px] text-hc-muted font-bold uppercase leading-tight italic">Adjusts the threshold for clinical risk detection and AI strictness during synthesis.</p>
            </div>

            <div className="space-y-4">
               <label className="text-[10px] font-black text-hc-muted uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Eye size={14}/> Forensic Verbosity
                </label>
                <div className="grid grid-cols-2 gap-3 p-2 hc-clay-inset rounded-2xl">
                  {[
                    { val: false, label: 'Summary', desc: 'Concise reports' },
                    { val: true, label: 'Forensic', desc: 'High-density' }
                  ].map(v => (
                    <button
                      key={String(v.val)}
                      onClick={() => setLogic({ ...logic, forensicVerbosity: v.val })}
                      className={`p-4 rounded-xl transition-all text-center
                        ${logic.forensicVerbosity === v.val ? 'hc-clay-raised text-hc-teal' : 'text-hc-muted hover:text-hc-text'}`}
                    >
                      <div className="text-[10px] font-black uppercase tracking-widest">{v.label}</div>
                      <div className="text-[8px] font-bold uppercase opacity-50 mt-1">{v.desc}</div>
                    </button>
                  ))}
                </div>
            </div>

            <div className="p-5 hc-clay-inset rounded-2xl border border-hc-teal/10 bg-hc-teal/5">
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle size={16} className="text-hc-teal" />
                <span className="text-[10px] font-black text-hc-teal uppercase tracking-widest">Logic Version v2.4.8</span>
              </div>
              <p className="text-[9px] font-bold text-hc-muted uppercase leading-relaxed">System using Deep Clinical Synthesis Engine. Locally processed on terminal.</p>
            </div>
          </div>
        </section>

        {/* ── MODULE C: UI HARDWARE TUNING ── */}
        <section className="hc-clay-raised p-8 rounded-[2.5rem] flex flex-col gap-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-teal"><Layers size={24} /></div>
            <div>
              <h2 className="text-lg font-black text-hc-text uppercase tracking-tight">Hardware Tuning</h2>
              <p className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-60">Visual Matrix Config</p>
            </div>
          </div>

          <div className="space-y-10">
            <div className="space-y-4">
               <label className="text-[10px] font-black text-hc-muted uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Gauge size={14}/> Compact Density
                </label>
                <div className="grid grid-cols-2 gap-3 p-2 hc-clay-inset rounded-2xl">
                  {[
                    { val: false, label: 'Breathable', desc: 'Standard UI' },
                    { val: true, label: 'Military', desc: 'High-density' }
                  ].map(v => (
                    <button
                      key={String(v.val)}
                      onClick={() => setUi({ ...ui, compactDensity: v.val })}
                      className={`p-4 rounded-xl transition-all text-center
                        ${ui.compactDensity === v.val ? 'hc-clay-raised text-hc-teal' : 'text-hc-muted hover:text-hc-text'}`}
                    >
                      <div className="text-[10px] font-black uppercase tracking-widest">{v.label}</div>
                      <div className="text-[8px] font-bold uppercase opacity-50 mt-1">{v.desc}</div>
                    </button>
                  ))}
                </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-hc-muted uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Zap size={14}/> Shadow Depth
                </label>
                <span className="text-[11px] font-black text-hc-teal uppercase">Level {ui.shadowDepth}</span>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(lvl => (
                  <button
                    key={lvl}
                    onClick={() => setUi({ ...ui, shadowDepth: lvl })}
                    className={`flex-1 py-3 rounded-xl transition-all font-black text-[11px]
                      ${ui.shadowDepth === lvl ? 'hc-clay-raised text-hc-teal scale-110 z-10' : 'hc-clay-inset text-hc-muted opacity-40'}`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="hc-clay-inset p-6 rounded-3xl flex flex-col items-center gap-4 opacity-60 grayscale hover:grayscale-0 transition-all cursor-help">
               <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-hc-border">
                  <img src={ORG_CONFIG.logoIcon} alt="Logo" className="w-8 h-8 opacity-80" />
                </div>
                <div className="text-center">
                  <div className="text-[9px] font-black text-hc-text uppercase mb-1">Branding Vector</div>
                  <div className="text-[8px] text-hc-muted font-bold uppercase">Stored in Sovereign Bridge</div>
                </div>
            </div>
          </div>
        </section>

        {/* ── MODULE D: FORENSIC SECURITY ── */}
        <section className="hc-clay-raised p-8 rounded-[2.5rem] flex flex-col gap-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-teal"><ShieldAlert size={24} /></div>
            <div>
              <h2 className="text-lg font-black text-hc-text uppercase tracking-tight">Forensic Security</h2>
              <p className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-60">Access & Session Govt</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-hc-muted uppercase tracking-widest ml-1 flex items-center gap-2">
                <Key size={14}/> Quick-PIN Management
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={security.accessPin}
                  onChange={e => { if (/^\d{0,4}$/.test(e.target.value)) setSecurity({ ...security, accessPin: e.target.value }); }}
                  className="w-full hc-clay-inset px-6 py-4 text-sm font-black text-hc-text tracking-[1em] outline-none rounded-2xl"
                  maxLength={4}
                  placeholder="····"
                />
                <button onClick={() => setShowPin(!showPin)} className="absolute right-4 top-1/2 -translate-y-1/2 text-hc-muted hover:text-hc-teal transition-colors">
                  {showPin ? <Eye size={16} /> : <Key size={16} />}
                </button>
              </div>
            </div>
            
            <button 
              onClick={handleSavePin} 
              className={`w-full py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all active:hc-clay-pressed
                ${saved === 'pin' ? 'bg-hc-teal text-hc-bone' : 'hc-clay-raised text-hc-text hover:text-hc-teal'}`}
            >
              {saved === 'pin' ? '✓ PIN Secured' : 'Lock Security Matrix'}
            </button>

            <div className="space-y-4 pt-4">
               <label className="text-[10px] font-black text-hc-muted uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Clock size={14}/> Session Expiry Protocol
                </label>
                <div className="grid grid-cols-2 gap-3 p-2 hc-clay-inset rounded-2xl">
                  {[
                    { id: 'keep-alive', label: 'Keep-Alive', desc: 'No auto-exit' },
                    { id: 'secure', label: 'Secure', desc: 'Auto-exit' }
                  ].map(v => (
                    <button
                      key={v.id}
                      onClick={() => setSecurity({ ...security, sessionExpiry: v.id })}
                      className={`p-4 rounded-xl transition-all text-center
                        ${security.sessionExpiry === v.id ? 'hc-clay-raised text-hc-teal' : 'text-hc-muted hover:text-hc-text'}`}
                    >
                      <div className="text-[10px] font-black uppercase tracking-widest">{v.label}</div>
                      <div className="text-[8px] font-bold uppercase opacity-50 mt-1">{v.desc}</div>
                    </button>
                  ))}
                </div>
            </div>
          </div>
        </section>

        {/* ── MODULE E: SYSTEM MATRIX LEDGER ── */}
        <section className="hc-clay-raised p-8 rounded-[2.5rem] xl:col-span-2 flex flex-col gap-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-teal"><HardDrive size={24} /></div>
              <div>
                <h2 className="text-lg font-black text-hc-text uppercase tracking-tight">System Matrix Ledger</h2>
                <p className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-60">Real-time Operational Logs</p>
              </div>
            </div>
            <div className="flex gap-2">
               <div className="px-4 py-2 hc-clay-inset rounded-xl text-[9px] font-black text-hc-teal uppercase tracking-widest">
                 Live Feed
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Logs View */}
            <div className="hc-clay-inset p-6 rounded-[2rem] space-y-4 max-h-[400px] overflow-y-auto scrollbar-none border border-hc-teal/5">
               {auditLogs.map(log => (
                 <div key={log.id} className="flex items-start gap-4 p-4 hc-clay-raised rounded-xl border border-hc-border/5 group hover:border-hc-teal/20 transition-all">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 
                      ${log.type === 'Injest' ? 'bg-hc-teal/10 text-hc-teal' : 
                        log.type === 'Synthesis' ? 'bg-hc-indigo/10 text-hc-indigo' : 
                        'bg-hc-amber/10 text-hc-amber'}`}>
                      {log.type === 'Injest' ? <Upload size={14}/> : 
                       log.type === 'Synthesis' ? <Cpu size={14}/> : 
                       <Shield size={14}/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-black text-hc-text uppercase tracking-tight truncate">{log.event}</div>
                      <div className="text-[9px] font-bold text-hc-muted uppercase mt-0.5">{formatTime(log.timestamp)} · CORE_OPS</div>
                    </div>
                    <div className="text-[8px] font-black text-hc-muted opacity-30 group-hover:opacity-100 transition-opacity">VERIFIED</div>
                 </div>
               ))}
            </div>

            {/* Storage Saturation */}
            <div className="flex flex-col gap-8">
               <div className="hc-clay-raised p-8 rounded-[2rem] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5 text-hc-teal group-hover:scale-125 transition-transform duration-1000">
                    <Brain size={160} />
                  </div>
                  <div className="relative z-10 space-y-8">
                    <div className="flex justify-between items-end">
                       <div>
                         <div className="text-[10px] font-black text-hc-muted uppercase tracking-widest mb-1">Diagnostic Saturation</div>
                         <div className="text-4xl font-black text-hc-teal tabular-nums">
                           {Math.round(((bounds?.count || 0) / 25000) * 100)}%
                         </div>
                       </div>
                       <div className="text-right">
                         <div className="text-[10px] font-black text-hc-muted uppercase tracking-widest mb-1">Brain Load</div>
                         <div className="text-xl font-black text-hc-text tabular-nums">{bounds?.count?.toLocaleString() || 0} Entries</div>
                       </div>
                    </div>

                    <div className="space-y-3">
                      <div className="h-3 rounded-full hc-clay-inset overflow-hidden p-0.5">
                        <div className="h-full bg-hc-teal rounded-full shadow-[0_0_15px_rgba(28,78,78,0.5)] transition-all duration-1000" style={{ width: `${Math.min(100, ((bounds?.count || 0) / 25000) * 100)}%` }} />
                      </div>
                      <div className="flex justify-between text-[9px] font-black text-hc-muted uppercase tracking-widest">
                        <span>Terminal Capacity</span>
                        <span>25k Diagnostic Limit</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <button className="flex items-center justify-center gap-3 py-4 hc-clay-raised text-[10px] font-black text-hc-text hover:text-hc-teal transition-all rounded-xl active:hc-clay-pressed">
                        <History size={14} /> Snapshot
                      </button>
                      <button onClick={handleClearMemory} className="flex items-center justify-center gap-3 py-4 hc-clay-raised text-[10px] font-black text-flag-red hover:bg-flag-red/5 transition-all rounded-xl active:hc-clay-pressed">
                        <Trash2 size={14} /> Purge
                      </button>
                    </div>
                  </div>
               </div>

               <div className="hc-clay-raised p-6 rounded-[2rem] bg-hc-teal text-hc-bone flex items-center justify-between border border-hc-bone/10">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"><Monitor size={20}/></div>
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-widest">Sovereign Terminal</div>
                      <div className="text-[9px] font-bold opacity-60 uppercase">E2E Local Indexing Active</div>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl hc-clay-inset bg-hc-teal border-hc-bone/20 flex items-center justify-center">
                     <Activity size={18} className="animate-pulse" />
                  </div>
               </div>
            </div>
          </div>
        </section>

        {/* ACTIVE SESSIONS MODULE */}
        <section className="hc-clay-raised p-8 rounded-[2.5rem] flex flex-col gap-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-teal"><Smartphone size={24} /></div>
                <div>
                  <h2 className="text-lg font-black text-hc-text uppercase tracking-tight">Access Points</h2>
                  <p className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-60">Authorized Nodes</p>
                </div>
              </div>
              <span className="px-3 py-1 hc-clay-inset rounded-lg text-[10px] font-black text-hc-teal">{sessions.length}</span>
            </div>

            <div className="space-y-4">
              {sessions.length === 0 ? (
                <div className="hc-clay-inset p-8 rounded-2xl text-center">
                  <p className="text-[10px] font-black text-hc-muted uppercase tracking-widest">No external nodes detected</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map(s => {
                    const isCurrent = s.id === currentSessionId;
                    const DeviceIcon = s.device === 'Mobile' ? Smartphone : Monitor;
                    return (
                      <div key={s.id} className={`p-4 rounded-2xl flex items-center justify-between gap-4 transition-all ${isCurrent ? 'hc-clay-raised border border-hc-teal/20 bg-hc-teal/5' : 'hc-clay-inset opacity-60 hover:opacity-100'}`}>
                        <div className="flex items-center gap-4 min-w-0">
                          <DeviceIcon size={18} className={isCurrent ? 'text-hc-teal' : 'text-hc-muted'} />
                          <div className="min-w-0">
                            <div className="text-[10px] font-black text-hc-text uppercase flex items-center gap-2">
                              {s.browser} · {s.device}
                              {isCurrent && <span className="text-[7px] px-1.5 py-0.5 bg-hc-teal text-hc-bone rounded-full">CORE</span>}
                            </div>
                            <div className="text-[8px] font-bold text-hc-muted uppercase mt-0.5 truncate">{formatTime(s.lastActive)}</div>
                          </div>
                        </div>
                        <button 
                          onClick={() => isCurrent ? onSignOut() : revokeSession(s.id)} 
                          className={`w-8 h-8 rounded-lg hc-clay-raised flex items-center justify-center transition-all ${isCurrent ? 'text-flag-red' : 'text-hc-muted hover:text-flag-red'}`}
                        >
                          {isCurrent ? <LogOut size={12} /> : <X size={12} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {sessions.length > 1 && (
                <button onClick={revokeAllOthers} className="w-full mt-4 py-4 hc-clay-raised text-[10px] font-black uppercase tracking-widest text-flag-red hover:bg-flag-red/5 transition-all flex items-center justify-center gap-3 active:hc-clay-pressed">
                  <ShieldAlert size={14} /> Revoke Remote Access
                </button>
              )}
            </div>
          </section>

      </div>

      {/* ── MATRIX FOOTER ── */}
      <div className="pt-12 pb-8 flex flex-col items-center gap-6">
        <div className="w-12 h-12 rounded-2xl hc-clay-raised flex items-center justify-center group cursor-pointer hover:rotate-12 transition-all">
          <img src={ORG_CONFIG.logoIcon} alt="HC" className="w-6 h-6 grayscale group-hover:grayscale-0 transition-all" />
        </div>
        <div className="text-center space-y-1">
          <div className="text-[10px] font-black text-hc-text uppercase tracking-[0.8em]">Sovereign Node v1.4.2</div>
          <div className="text-[8px] font-bold text-hc-muted uppercase tracking-widest opacity-40">Person-Centered Intelligence · Encryption Active</div>
        </div>
      </div>

    </div>
  );
}
