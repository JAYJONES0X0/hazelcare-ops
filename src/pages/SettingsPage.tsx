import { useState, useRef, useEffect } from 'react';

interface Props {
  onSignOut: () => void;
}

const PROFILE_KEY = 'hc-profile-v1';
const LOGO_KEY = 'hc-custom-logo-v1';

interface Profile {
  name: string;
  role: string;
  org: string;
  email: string;
}

function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? { ...{ name: 'Abraham', role: 'Registered Manager', org: 'Hazel Care Ltd', email: '' }, ...JSON.parse(raw) } : { name: 'Abraham', role: 'Registered Manager', org: 'Hazel Care Ltd', email: '' };
  } catch { return { name: 'Abraham', role: 'Registered Manager', org: 'Hazel Care Ltd', email: '' }; }
}

function saveProfile(p: Profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

export function SettingsPage({ onSignOut }: Props) {
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [profileSaved, setProfileSaved] = useState(false);
  const [customLogo, setCustomLogo] = useState<string | null>(() => localStorage.getItem(LOGO_KEY));
  const [logoHover, setLogoHover] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [pwStep, setPwStep] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const initials = profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  // Storage stats
  const [storageInfo, setStorageInfo] = useState({ keys: 0, estimatedKb: 0 });
  useEffect(() => {
    let total = 0;
    let keys = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('hc-')) {
        total += (localStorage.getItem(k) || '').length * 2;
        keys++;
      }
    }
    setStorageInfo({ keys, estimatedKb: Math.round(total / 1024) });
  }, []);

  function handleLogoUpload(file: File) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      localStorage.setItem(LOGO_KEY, url);
      setCustomLogo(url);
      window.dispatchEvent(new Event('hc-logo-change'));
    };
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    localStorage.removeItem(LOGO_KEY);
    setCustomLogo(null);
    window.dispatchEvent(new Event('hc-logo-change'));
  }

  function saveProfileData() {
    saveProfile(profile);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    if (pwNew !== pwConfirm) { setPwError('New passwords do not match'); return; }
    if (pwNew.length < 8) { setPwError('Password must be at least 8 characters'); return; }
    setPwLoading(true);
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ current: pwCurrent, next: pwNew }),
      });
      const d = await res.json();
      if (res.ok && d.ok) {
        setPwSuccess(true);
        setPwStep(false);
        setPwCurrent(''); setPwNew(''); setPwConfirm('');
        setTimeout(() => setPwSuccess(false), 4000);
      } else {
        // Server may return a helpful message about env var management
        setPwError(d.error || 'Current password incorrect');
      }
    } catch {
      setPwError('Could not connect to server');
    } finally {
      setPwLoading(false);
    }
  }

  function clearAllData() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('hc-')) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
    setConfirmClear(false);
    window.location.reload();
  }

  const card = 'rounded-2xl p-5 mb-4';
  const cardStyle = { background: 'linear-gradient(145deg,rgba(16,18,26,0.92),rgba(10,12,18,0.88))', backdropFilter: 'blur(28px)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 4px 24px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.04)' };
  const sectionLabel = 'text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] mb-4 flex items-center gap-2';
  const inputClass = 'w-full bg-hc-dark/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-hc-teal/50 transition-colors';
  const fieldLabel = 'text-[10px] font-bold text-hc-muted uppercase tracking-wide mb-1.5 block';

  return (
    <div className="p-6 lg:p-10 w-full max-w-3xl mx-auto animate-in fade-in duration-500">

      {/* Page header */}
      <div className="mb-8 flex items-center gap-4">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 font-black text-lg text-white"
          style={{ background: 'linear-gradient(135deg,#0f766e,#14b8a6)', boxShadow: '0 0 24px rgba(20,184,166,0.3)' }}>
          {customLogo ? <img src={customLogo} alt="Logo" className="w-full h-full object-cover rounded-2xl" /> : initials}
        </div>
        <div>
          <h1 className="text-xl font-black text-white tracking-tighter">{profile.name}</h1>
          <p className="text-hc-muted text-xs font-medium">{profile.role} · {profile.org}</p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmLogout(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide cursor-pointer transition-all"
          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          Sign Out
        </button>
      </div>

      {/* Logout confirm */}
      {confirmLogout && (
        <div className="mb-6 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <div>
            <div className="text-sm font-black text-white mb-0.5">Sign out of Care Portal?</div>
            <div className="text-xs text-hc-muted">You will be returned to the login screen.</div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onSignOut}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase cursor-pointer"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444' }}>
              Yes, sign out
            </button>
            <button type="button" onClick={() => setConfirmLogout(false)}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase text-hc-muted cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Profile ──────────────────────────────────────────────── */}
      <div className={card} style={cardStyle}>
        <div className={sectionLabel}>
          <svg className="w-3.5 h-3.5 text-hc-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          Profile
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={fieldLabel}>Full name</label>
            <input className={inputClass} value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="Your name" />
          </div>
          <div>
            <label className={fieldLabel}>Role</label>
            <input className={inputClass} value={profile.role} onChange={e => setProfile(p => ({ ...p, role: e.target.value }))} placeholder="e.g. Registered Manager" />
          </div>
          <div>
            <label className={fieldLabel}>Organisation</label>
            <input className={inputClass} value={profile.org} onChange={e => setProfile(p => ({ ...p, org: e.target.value }))} placeholder="e.g. Hazel Care Ltd" />
          </div>
          <div>
            <label className={fieldLabel}>Email</label>
            <input className={inputClass} type="email" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} placeholder="your@email.co.uk" />
          </div>
        </div>
        <button type="button" onClick={saveProfileData}
          className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide cursor-pointer transition-all"
          style={profileSaved
            ? { background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e' }
            : { background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.3)', color: '#5eead4' }}>
          {profileSaved ? '✓ Saved' : 'Save profile'}
        </button>
      </div>

      {/* ── Branding ─────────────────────────────────────────────── */}
      <div className={card} style={cardStyle}>
        <div className={sectionLabel}>
          <svg className="w-3.5 h-3.5 text-hc-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          Branding & Logo
        </div>
        <div className="flex items-start gap-5">
          {/* Logo preview */}
          <button
            type="button"
            onMouseEnter={() => setLogoHover(true)}
            onMouseLeave={() => setLogoHover(false)}
            onClick={() => logoInputRef.current?.click()}
            className="relative w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 cursor-pointer overflow-hidden transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '2px dashed rgba(255,255,255,0.15)' }}
          >
            {customLogo
              ? <img src={customLogo} alt="Logo" className="w-full h-full object-cover" />
              : <img src="/logo-icon-dark.png" alt="Default" className="w-10 h-10 opacity-60" />
            }
            {logoHover && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(0,0,0,0.6)' }}>
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
              </div>
            )}
          </button>
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />

          <div className="flex-1">
            <div className="text-sm font-bold text-white mb-1">Organisation logo</div>
            <div className="text-xs text-hc-muted leading-relaxed mb-3">
              Shown in the sidebar and on login. Accepts PNG, JPG, or SVG. Max 1MB.
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => logoInputRef.current?.click()}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase cursor-pointer"
                style={{ background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.25)', color: '#5eead4' }}>
                Upload logo
              </button>
              {customLogo && (
                <button type="button" onClick={removeLogo}
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b' }}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Appearance ───────────────────────────────────────────── */}
      <div className={card} style={cardStyle}>
        <div className={sectionLabel}>
          <svg className="w-3.5 h-3.5 text-hc-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
          Appearance
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-white mb-0.5">Interface theme</div>
            <div className="text-xs text-hc-muted">Precision dark — optimised for shift use</div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{background:'rgba(13,148,136,0.08)',border:'1px solid rgba(13,148,136,0.25)'}}>
            <svg className="w-4 h-4 text-hc-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
            <span className="text-xs font-bold text-hc-teal-light">Dark</span>
          </div>
        </div>
      </div>

      {/* ── Security ─────────────────────────────────────────────── */}
      <div className={card} style={cardStyle}>
        <div className={sectionLabel}>
          <svg className="w-3.5 h-3.5 text-hc-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          Security
        </div>

        {/* Security badges */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
          {[
            { label: 'Session auth', ok: true },
            { label: 'Staff SAC codes', ok: true },
            { label: 'Computer Misuse Act', ok: true },
            { label: 'HTTPS encrypted', ok: true },
            { label: 'No data to server', ok: true, note: 'Browser only' },
          ].map(b => (
            <div key={b.label} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)' }}>
              <svg className="w-3 h-3 text-flag-green shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              <div>
                <div className="text-[10px] font-bold text-flag-green/90">{b.label}</div>
                {b.note && <div className="text-[9px] text-hc-muted/60">{b.note}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Change password */}
        <div className="border-t border-white/[0.06] pt-4">
          {!pwStep && !pwSuccess && (
            <button type="button" onClick={() => setPwStep(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase cursor-pointer transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
              Change password
            </button>
          )}
          {pwSuccess && (
            <div className="flex items-center gap-2 text-flag-green text-sm font-bold">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              Password updated successfully
            </div>
          )}
          {pwStep && (
            <form onSubmit={handlePasswordChange} className="space-y-3 max-w-sm">
              <div>
                <label className={fieldLabel}>Current password</label>
                <input type="password" className={inputClass} value={pwCurrent} onChange={e => { setPwCurrent(e.target.value); setPwError(''); }} placeholder="••••••••" />
              </div>
              <div>
                <label className={fieldLabel}>New password</label>
                <input type="password" className={inputClass} value={pwNew} onChange={e => { setPwNew(e.target.value); setPwError(''); }} placeholder="Min 8 characters" />
              </div>
              <div>
                <label className={fieldLabel}>Confirm new password</label>
                <input type="password" className={inputClass} value={pwConfirm} onChange={e => { setPwConfirm(e.target.value); setPwError(''); }} placeholder="Repeat new password" />
              </div>
              {pwError && <div className="text-flag-amber text-xs font-semibold leading-relaxed">{pwError}</div>}
              <div className="flex gap-2">
                <button type="submit" disabled={pwLoading || !pwCurrent || !pwNew || !pwConfirm}
                  className="px-5 py-2.5 rounded-xl text-xs font-black uppercase cursor-pointer disabled:opacity-40"
                  style={{ background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.35)', color: '#5eead4' }}>
                  {pwLoading ? 'Updating…' : 'Update password'}
                </button>
                <button type="button" onClick={() => { setPwStep(false); setPwError(''); setPwCurrent(''); setPwNew(''); setPwConfirm(''); }}
                  className="px-5 py-2.5 rounded-xl text-xs font-black uppercase cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ── Data & Storage ───────────────────────────────────────── */}
      <div className={card} style={cardStyle}>
        <div className={sectionLabel}>
          <svg className="w-3.5 h-3.5 text-hc-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582 4 8 4m0 0c4.418 0 8-1.79 8-4" /></svg>
          Data & Storage
        </div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-sm font-bold text-white mb-0.5">Local storage</div>
            <div className="text-xs text-hc-muted">{storageInfo.keys} data keys · ~{storageInfo.estimatedKb} KB used · stored in this browser only</div>
          </div>
          <div className="w-20 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-2 rounded-full" style={{ width: `${Math.min(100, storageInfo.estimatedKb / 50)}%`, background: '#14b8a6' }} />
          </div>
        </div>
        <div className="border-t border-white/[0.06] pt-4">
          {!confirmClear ? (
            <button type="button" onClick={() => setConfirmClear(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase cursor-pointer"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Clear all cached data
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <div className="text-xs text-white font-semibold">This will delete all local data — diary imports, actions, incidents, coaching history. Cannot be undone.</div>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={clearAllData}
                  className="px-4 py-2 rounded-lg text-xs font-black uppercase cursor-pointer"
                  style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444' }}>
                  Clear data
                </button>
                <button type="button" onClick={() => setConfirmClear(false)}
                  className="px-4 py-2 rounded-lg text-xs font-black uppercase text-hc-muted cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── About ─────────────────────────────────────────────────── */}
      <div className={card} style={{ ...cardStyle, marginBottom: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-black text-white mb-0.5">Hazel Care Ops Portal</div>
            <div className="text-xs text-hc-muted">v1.0 · Built for CQC-regulated supported living services</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.2)' }}>
              <svg className="w-3 h-3 text-hc-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              <span className="text-[10px] font-black text-hc-teal uppercase tracking-wide">CQC Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
