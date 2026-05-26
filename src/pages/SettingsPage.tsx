import { useState, useRef } from 'react';
import {
  ShieldCheck, Lock, Activity, Shield, Database, Trash2,
  ShieldAlert, Building2, Key, Download, Upload, CheckCheck,
  Save, Eye, EyeOff, LogOut, RefreshCw, Settings, User, ImagePlus,
} from 'lucide-react';
import type { Page } from '../lib/types';
import { ORG_CONFIG, loadRawOrgSettings, saveOrgSettings, type OrgSettingsOverride } from '../lib/config';
import { purgeSystemDataAsync } from '../lib/governance-utils';
import { exportOpsSnapshot, importOpsSnapshot, clearAllData } from '../lib/storage';

interface Props {
  onSignOut: () => void;
  setPage: (p: Page) => void;
}

type Section = 'org' | 'security' | 'data' | 'session';

// ── Helpers ──────────────────────────────────────────────────────

function SectionTab({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
        active ? 'btn-tactical shadow-xl' : 'hc-clay-raised text-hc-muted hover:text-hc-text active:hc-clay-pressed'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function useImageUpload(storageKey: string) {
  const [src, setSrc] = useState<string>(() => localStorage.getItem(storageKey) || '');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const b64 = e.target?.result as string;
      localStorage.setItem(storageKey, b64);
      setSrc(b64);
      window.dispatchEvent(new Event('hc-brand-updated'));
    };
    reader.readAsDataURL(file);
  };

  const clear = () => {
    localStorage.removeItem(storageKey);
    setSrc('');
    window.dispatchEvent(new Event('hc-brand-updated'));
  };

  return { src, inputRef, handleFile, clear };
}

// ── Org Settings Section ─────────────────────────────────────────

function OrgSection() {
  const [form, setForm] = useState<OrgSettingsOverride>(() => loadRawOrgSettings());
  const [saved, setSaved] = useState(false);
  const {
    src: logoSrc,
    inputRef: logoInputRef,
    handleFile: handleLogoFile,
    clear: clearLogo,
  } = useImageUpload('hc-org-logo');

  const fields: { key: keyof OrgSettingsOverride; label: string; placeholder: string }[] = [
    { key: 'name', label: 'Organisation Name', placeholder: ORG_CONFIG.name },
    { key: 'fullName', label: 'Full Legal Name', placeholder: ORG_CONFIG.fullName },
    { key: 'cqcNumber', label: 'CQC Registration No.', placeholder: 'e.g. 1-XXXXXXXXXX' },
    { key: 'address', label: 'Registered Address', placeholder: 'e.g. 123 High Street, Bristol, BS1 1AA' },
    { key: 'phone', label: 'Main Contact Number', placeholder: 'e.g. 01174 000000' },
    { key: 'supportEmail', label: 'Support Email', placeholder: ORG_CONFIG.supportEmail },
    { key: 'tagline', label: 'Tagline', placeholder: ORG_CONFIG.tagline },
  ];

  const handleSave = () => {
    saveOrgSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Logo upload */}
      <div className="hc-clay-raised p-8 rounded-[2.5rem]">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-teal"><ImagePlus size={24} /></div>
          <div>
            <h2 className="text-lg font-black text-hc-text uppercase tracking-tight">Organisation Logo</h2>
            <p className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-60">Shown in the sidebar — updates immediately</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-2xl hc-clay-inset flex items-center justify-center overflow-hidden shrink-0">
            {logoSrc
              ? <img src={logoSrc} alt="Logo" className="w-full h-full object-contain p-2" />
              : <img src={ORG_CONFIG.logoIcon} alt="Logo" className="w-10 h-10 opacity-40" />
            }
          </div>
          <div className="flex flex-col gap-3 flex-1">
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); }} />
            <button onClick={() => logoInputRef.current?.click()}
              className="px-6 py-3 rounded-xl btn-tactical text-[10px] font-black uppercase tracking-widest flex items-center gap-2 w-fit">
              <Upload size={13} /> Upload Logo
            </button>
            {logoSrc && (
              <button onClick={clearLogo}
                className="px-6 py-3 rounded-xl hc-clay-raised text-[10px] font-black uppercase tracking-widest text-flag-red border border-flag-red/20 hover:bg-flag-red/5 transition-all w-fit">
                Remove
              </button>
            )}
            <p className="text-[9px] font-bold text-hc-muted uppercase tracking-wider opacity-50">PNG, JPG or SVG · Saved locally to this browser</p>
          </div>
        </div>
      </div>

      {/* Org details */}
      <div className="hc-clay-raised p-8 rounded-[2.5rem]">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-teal"><Building2 size={24} /></div>
          <div>
            <h2 className="text-lg font-black text-hc-text uppercase tracking-tight">Organisation Identity</h2>
            <p className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-60">Displayed across all documents and reports</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-2">
              <label className="text-[9px] font-black text-hc-muted uppercase tracking-widest">{label}</label>
              <div className="hc-clay-inset rounded-xl px-4 py-3">
                <input
                  type="text"
                  value={form[key] ?? ''}
                  onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full bg-transparent text-[11px] font-bold text-hc-text placeholder:text-hc-muted/40 outline-none"
                />
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={handleSave}
          className={`mt-8 w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-[11px] uppercase tracking-widest transition-all shadow-xl ${
            saved ? 'bg-flag-green/20 text-flag-green border border-flag-green/30' : 'btn-tactical'
          }`}
        >
          {saved ? <CheckCheck size={16} /> : <Save size={16} />}
          {saved ? 'Changes Saved' : 'Save Organisation Settings'}
        </button>
      </div>
    </div>
  );
}

// ── Security Section ─────────────────────────────────────────────

function SecuritySection({ onSignOut }: { onSignOut: () => void }) {
  const avatar = useImageUpload('hc-user-avatar');
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleChangePassword = async () => {
    if (!current || !newPass || !confirm) { setResult({ ok: false, msg: 'All fields required.' }); return; }
    if (newPass !== confirm) { setResult({ ok: false, msg: 'New passwords do not match.' }); return; }
    if (newPass.length < 8) { setResult({ ok: false, msg: 'New password must be at least 8 characters.' }); return; }

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword: current, newPassword: newPass }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (res.ok && json.ok) {
        setResult({ ok: true, msg: 'Password updated successfully.' });
        setCurrent(''); setNewPass(''); setConfirm('');
      } else {
        setResult({ ok: false, msg: (json.error as string) || 'Failed to update password.' });
      }
    } catch {
      setResult({ ok: false, msg: 'Network error — could not reach server.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile photo */}
      <div className="hc-clay-raised p-8 rounded-[2.5rem]">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-teal"><ImagePlus size={24} /></div>
          <div>
            <h2 className="text-lg font-black text-hc-text uppercase tracking-tight">Profile Photo</h2>
            <p className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-60">Shows in the sidebar for this device</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full hc-clay-inset flex items-center justify-center overflow-hidden shrink-0 border-2 border-hc-teal/20">
            {avatar.src
              ? <img src={avatar.src} alt="Avatar" className="w-full h-full object-cover" />
              : <User size={28} className="text-hc-muted opacity-40" />
            }
          </div>
          <div className="flex flex-col gap-3">
            <input ref={avatar.inputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) avatar.handleFile(f); }} />
            <button onClick={() => avatar.inputRef.current?.click()}
              className="px-6 py-3 rounded-xl btn-tactical text-[10px] font-black uppercase tracking-widest flex items-center gap-2 w-fit">
              <Upload size={13} /> Upload Photo
            </button>
            {avatar.src && (
              <button onClick={avatar.clear}
                className="px-6 py-3 rounded-xl hc-clay-raised text-[10px] font-black uppercase tracking-widest text-flag-red border border-flag-red/20 hover:bg-flag-red/5 transition-all w-fit">
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="hc-clay-raised p-8 rounded-[2.5rem]">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-teal"><Key size={24} /></div>
          <div>
            <h2 className="text-lg font-black text-hc-text uppercase tracking-tight">Change Password</h2>
            <p className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-60">Updates the system access credential</p>
          </div>
        </div>

        <div className="space-y-4">
          {[
            { label: 'Current Password', value: current, set: setCurrent, show: showCurrent, toggle: () => setShowCurrent(v => !v) },
            { label: 'New Password', value: newPass, set: setNewPass, show: showNew, toggle: () => setShowNew(v => !v) },
            { label: 'Confirm New Password', value: confirm, set: setConfirm, show: showNew, toggle: () => setShowNew(v => !v) },
          ].map(({ label, value, set, show, toggle }) => (
            <div key={label} className="space-y-2">
              <label className="text-[9px] font-black text-hc-muted uppercase tracking-widest">{label}</label>
              <div className="hc-clay-inset rounded-xl px-4 py-3 flex items-center gap-3">
                <input
                  type={show ? 'text' : 'password'}
                  value={value}
                  onChange={e => set(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && void handleChangePassword()}
                  className="flex-1 bg-transparent text-[11px] font-bold text-hc-text outline-none"
                />
                <button onClick={toggle} className="text-hc-muted hover:text-hc-text transition-colors">
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>

        {result && (
          <div className={`mt-4 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest ${result.ok ? 'bg-flag-green/10 text-flag-green border border-flag-green/30' : 'bg-flag-red/10 text-flag-red border border-flag-red/30'}`}>
            {result.msg}
          </div>
        )}

        <button
          onClick={() => void handleChangePassword()}
          disabled={loading}
          className="mt-6 w-full py-4 rounded-2xl btn-tactical flex items-center justify-center gap-3 font-black text-[11px] uppercase tracking-widest shadow-xl disabled:opacity-50"
        >
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Key size={14} />}
          {loading ? 'Updating…' : 'Update Password'}
        </button>
      </div>

      {/* Sign Out */}
      <div className="hc-clay-raised p-8 rounded-[2.5rem]">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-muted"><LogOut size={24} /></div>
          <div>
            <h2 className="text-lg font-black text-hc-text uppercase tracking-tight">Session Control</h2>
            <p className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-60">Terminate this active session</p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="w-full py-4 rounded-2xl hc-clay-raised text-[11px] font-black uppercase tracking-widest text-flag-red border border-flag-red/20 hover:bg-flag-red/5 transition-all flex items-center justify-center gap-3 shadow-xl active:hc-clay-pressed"
        >
          <LogOut size={14} />
          Sign Out of System
        </button>
      </div>
    </div>
  );
}

// ── Data Section ─────────────────────────────────────────────────

function DataSection() {
  const [importResult, setImportResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [clearState, setClearState] = useState<'idle' | 'confirm' | 'done'>('idle');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const snapshot = exportOpsSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `care-ops-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const snapshot = JSON.parse(text) as unknown;
      const result = importOpsSnapshot(snapshot);
      if (result.ok) {
        setImportResult({ ok: true, msg: 'Data restored successfully. Reload to apply.' });
      } else {
        setImportResult({ ok: false, msg: result.error });
      }
    } catch {
      setImportResult({ ok: false, msg: 'Could not parse backup file.' });
    }
  };

  const handleClear = () => {
    if (clearState === 'idle') { setClearState('confirm'); return; }
    clearAllData();
    setClearState('done');
    setTimeout(() => window.location.reload(), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Export */}
      <div className="hc-clay-raised p-8 rounded-[2.5rem]">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-teal"><Download size={24} /></div>
          <div>
            <h2 className="text-lg font-black text-hc-text uppercase tracking-tight">Export Backup</h2>
            <p className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-60">Download all actions, incidents, and staff data as JSON</p>
          </div>
        </div>
        <button onClick={handleExport} className="w-full py-4 rounded-2xl btn-tactical flex items-center justify-center gap-3 font-black text-[11px] uppercase tracking-widest shadow-xl">
          <Download size={14} />
          Download Backup
        </button>
      </div>

      {/* Import */}
      <div className="hc-clay-raised p-8 rounded-[2.5rem]">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-teal"><Upload size={24} /></div>
          <div>
            <h2 className="text-lg font-black text-hc-text uppercase tracking-tight">Restore from Backup</h2>
            <p className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-60">Replace current data with a previous backup file</p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) void handleImport(f); }}
        />
        {importResult && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest ${importResult.ok ? 'bg-flag-green/10 text-flag-green border border-flag-green/30' : 'bg-flag-red/10 text-flag-red border border-flag-red/30'}`}>
            {importResult.msg}
          </div>
        )}
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full py-4 rounded-2xl hc-clay-raised text-[11px] font-black uppercase tracking-widest text-hc-text border border-hc-teal/20 hover:bg-hc-teal/5 transition-all flex items-center justify-center gap-3 shadow-xl active:hc-clay-pressed"
        >
          <Upload size={14} />
          Select Backup File
        </button>
      </div>

      {/* Clear Data */}
      <div className="hc-clay-raised p-8 rounded-[2.5rem] border border-flag-amber/20">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center text-flag-amber"><Database size={24} /></div>
          <div>
            <h2 className="text-lg font-black text-hc-text uppercase tracking-tight">Clear All Data</h2>
            <p className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-60">Wipe actions, incidents, staff, and shifts from this device</p>
          </div>
        </div>
        <button
          onClick={handleClear}
          className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-[11px] uppercase tracking-widest transition-all shadow-xl ${
            clearState === 'confirm' ? 'bg-flag-amber text-hc-bone' :
            clearState === 'done' ? 'bg-flag-green/20 text-flag-green border border-flag-green/30' :
            'hc-clay-raised text-flag-amber border border-flag-amber/20 hover:bg-flag-amber/5 active:hc-clay-pressed'
          }`}
        >
          <Trash2 size={14} />
          {clearState === 'confirm' ? 'Tap again to confirm clear' : clearState === 'done' ? 'Cleared — reloading…' : 'Clear All Data'}
        </button>
        {clearState === 'confirm' && (
          <p className="text-[9px] font-black text-flag-amber text-center mt-3 uppercase tracking-widest opacity-70">
            This cannot be undone. Export a backup first.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Hardware Burn ────────────────────────────────────────────────

function HardwareBurnSection() {
  const burnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearBurnTimer = () => {
    if (burnTimerRef.current) {
      clearTimeout(burnTimerRef.current);
      burnTimerRef.current = null;
    }
  };

  return (
    <div className="hc-clay-raised p-8 rounded-[2.5rem] border border-flag-red/20 bg-flag-red/5 space-y-8 group">
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
            const timer = setTimeout(async () => {
              if (confirm('NUCLEAR PURGE: This will wipe EVERYTHING on this hardware. Proceed?')) {
                await purgeSystemDataAsync();
              }
            }, 2000);
            burnTimerRef.current = timer;
          }}
          onMouseUp={(e) => {
            e.currentTarget.classList.remove('scale-95', 'bg-black');
            clearBurnTimer();
          }}
          onMouseLeave={(e) => {
            e.currentTarget.classList.remove('scale-95', 'bg-black');
            clearBurnTimer();
          }}
          className="w-full py-5 rounded-2xl bg-flag-red text-hc-bone font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl transition-all duration-300 relative overflow-hidden active:shadow-inner"
        >
          Hold 2s to Initiate Burn
        </button>
      </div>
    </div>
  );
}

// ── Main Settings Page ───────────────────────────────────────────

export function SettingsPage({ onSignOut }: Props) {
  const [pin, setPin] = useState('');
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>('org');

  // Detect node hash on mount
  const [nodeHash] = useState(() => {
    let hash = localStorage.getItem('hc-node-hash');
    if (!hash) {
      hash = 'HC-' + Math.random().toString(36).substring(2, 12).toUpperCase();
      localStorage.setItem('hc-node-hash', hash);
    }
    return hash;
  });

  const handlePinSubmit = () => {
    if (pin === '236693!') {
      setPinUnlocked(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPin('');
      setTimeout(() => setPinError(false), 1000);
    }
  };

  if (!pinUnlocked) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6 animate-in fade-in duration-1000">
        <div className="w-full max-w-md hc-clay-raised p-12 rounded-[3.5rem] flex flex-col items-center gap-10 border border-hc-teal/20 shadow-2xl relative overflow-hidden">
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
          <button onClick={handlePinSubmit} className="w-full py-5 rounded-2xl btn-tactical text-[11px] font-black uppercase tracking-[0.3em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
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

  const sections = [
    { id: 'org' as Section, label: 'Organisation', icon: <Building2 size={14} /> },
    { id: 'security' as Section, label: 'Security', icon: <Key size={14} /> },
    { id: 'data' as Section, label: 'Data', icon: <Database size={14} /> },
    { id: 'session' as Section, label: 'Hardware', icon: <ShieldAlert size={14} /> },
  ];

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto animate-in fade-in duration-700">

      {/* ── HEADER ── */}
      <div className="mb-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-hc-border/10 pb-10">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-6 h-6 text-hc-teal" />
            <h1 className="text-2xl md:text-4xl font-black text-hc-text tracking-[0.2em] uppercase">System Settings</h1>
          </div>
          <p className="text-hc-muted text-[11px] font-bold uppercase tracking-wider leading-relaxed">
            Organisation Config · Security · Data Management
          </p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 px-4 py-2 hc-clay-inset rounded-xl border border-hc-teal/10">
            <User size={12} className="text-hc-teal" />
            <span className="text-[9px] font-black text-hc-muted uppercase tracking-widest truncate max-w-[140px]">{nodeHash}</span>
          </div>
          <button onClick={() => setPinUnlocked(false)} className="px-6 py-2.5 hc-clay-raised text-[9px] font-black uppercase tracking-widest text-hc-teal border border-hc-teal/20 hover:bg-hc-teal/5 transition-all active:hc-clay-pressed flex items-center gap-2 rounded-xl">
            <Lock size={12} />
            Lock
          </button>
        </div>
      </div>

      {/* ── TAB NAV ── */}
      <div className="flex flex-wrap gap-3 mb-10">
        {sections.map(s => (
          <SectionTab key={s.id} {...s} active={activeSection === s.id} onClick={() => setActiveSection(s.id)} />
        ))}
      </div>

      {/* ── SECTION CONTENT ── */}
      <div className="animate-in fade-in duration-300">
        {activeSection === 'org' && <OrgSection />}
        {activeSection === 'security' && <SecuritySection onSignOut={onSignOut} />}
        {activeSection === 'data' && <DataSection />}
        {activeSection === 'session' && (
          <div className="space-y-6">
            <div className="hc-clay-raised p-8 rounded-[2.5rem]">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-teal"><Shield size={24} /></div>
                <div>
                  <h2 className="text-lg font-black text-hc-text uppercase tracking-tight">Device Identity</h2>
                  <p className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-60">This node's hardware fingerprint</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 hc-clay-inset rounded-2xl">
                  <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">Node Hash</span>
                  <span className="text-[11px] font-mono font-bold text-hc-teal uppercase tracking-tighter">{nodeHash}</span>
                </div>
                <div className="flex items-center justify-between p-4 hc-clay-inset rounded-2xl">
                  <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">Auth Level</span>
                  <span className="text-[11px] font-black text-hc-teal uppercase tracking-widest">Sovereign Admin</span>
                </div>
                <div className="flex items-center justify-between p-4 hc-clay-inset rounded-2xl">
                  <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">Platform</span>
                  <span className="text-[11px] font-black text-hc-text uppercase">
                    {/Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop'} ·{' '}
                    {navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Safari'}
                  </span>
                </div>
              </div>
            </div>
            <HardwareBurnSection />
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div className="pt-16 pb-8 flex flex-col items-center gap-4 border-t border-hc-border/10 mt-12">
        <div className="flex items-center gap-3 px-6 py-3 rounded-2xl hc-clay-inset border border-hc-teal/20 text-hc-teal">
          <Activity size={14} className="animate-pulse" />
          <span className="text-[9px] font-black uppercase tracking-[0.3em]">Care Ops · System Core v1.0</span>
        </div>
      </div>
    </div>
  );
}
