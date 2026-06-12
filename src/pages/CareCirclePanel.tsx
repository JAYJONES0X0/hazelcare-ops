import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle, Copy, MessageSquare, Plus, Save, ShieldCheck, Sparkles, Trash2, Users } from 'lucide-react';
import {
  emptyCareCircle,
  loadClients,
  saveClient,
  type CareCircleConcern,
  type CareCircleContact,
  type CareCircleMode,
  type CareCirclePermissionLevel,
  type CareCircleUpdate,
  type FullClient,
} from '../lib/client-store';
import { loadWeekData, uid } from '../lib/storage';
import type { CareEntry } from '../lib/types';

interface Props {
  clientId: string;
  onBack: () => void;
}

const MODE_LABELS: Record<CareCircleMode, string> = {
  off: 'Off',
  light_reassurance: 'Light Reassurance',
  standard_family_window: 'Standard Family Window',
  collaborative: 'Collaborative Care Circle',
  professional_access: 'Professional Access',
};

const PERMISSION_LABELS: Record<CareCirclePermissionLevel, string> = {
  reassurance: 'Reassurance',
  care_plan: 'Care Plan',
  risk_aware: 'Risk Aware',
  professional: 'Professional',
};

function todayIso() {
  return new Date().toISOString();
}

function todayUk() {
  return new Date().toLocaleDateString('en-GB');
}

function firstName(client: FullClient) {
  return client.preferredName || client.name.split(' ')[0] || 'this person';
}

function cleanLine(input: string | undefined, max = 180) {
  const text = (input || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 3).trim()}...` : text;
}

function isSensitive(entry: CareEntry) {
  const text = `${entry.type} ${entry.entry} ${(entry.flags || []).join(' ')}`.toLowerCase();
  return /safeguard|abuse|alleg|police|financial|money|medication error|self-harm|suicide|assault|violence|injur|capacity|deprivation|domestic|exploitation|complaint/.test(text)
    || entry.severity === 'red';
}

function inferMood(entries: CareEntry[]) {
  const text = entries.map((entry) => entry.entry).join(' ').toLowerCase();
  if (/happy|chatty|laugh|good spirits|settled|calm|relaxed|bright/.test(text)) return 'Settled, engaged, or in good spirits at points during the period.';
  if (/anxious|low mood|upset|distress|agitated|withdrawn/.test(text)) return 'Some changes in mood or presentation were noted and should be reviewed before sharing.';
  return 'No clear mood pattern was identified from the selected evidence.';
}

function taskSummary(entries: CareEntry[]) {
  const types = Array.from(new Set(entries.map((entry) => entry.type).filter(Boolean))).slice(0, 5);
  if (types.length) return types.join(', ');
  return 'General support, wellbeing checks, and daily living support where evidenced.';
}

function buildFamilySummary(client: FullClient, entries: CareEntry[], mode: CareCircleMode) {
  const name = firstName(client);
  const safeEntries = entries.filter((entry) => !isSensitive(entry)).slice(0, 8);
  const sensitiveCount = entries.length - safeEntries.length;
  const careDomains = client.carePlan?.domains?.filter((domain) => domain.enabled).slice(0, 4).map((domain) => domain.title) || [];
  const source = safeEntries.length ? safeEntries : entries.slice(0, 3);
  const evidenceLines = source.map((entry) => cleanLine(entry.entry, 150)).filter(Boolean).slice(0, 3);

  const lines = [
    `Family update for ${name} - ${todayUk()}`,
    '',
    `Mode: ${MODE_LABELS[mode]}. This is a manager-reviewed summary, not a raw care record.`,
    '',
    `Wellbeing: ${inferMood(entries)}`,
    `Support covered: ${taskSummary(entries)}`,
    careDomains.length ? `Care areas in view: ${careDomains.join(', ')}.` : '',
    evidenceLines.length ? `Meaningful notes: ${evidenceLines.join(' ')}` : `Meaningful notes: No share-ready diary evidence is available yet for ${name}.`,
    sensitiveCount > 0 ? `Manager review required: ${sensitiveCount} source entr${sensitiveCount === 1 ? 'y was' : 'ies were'} held back because they may contain risk, safeguarding, medication, finance, or other sensitive detail.` : 'No high-sensitivity source entries were detected in this generated draft.',
    '',
    'Before sharing: confirm consent, relationship permissions, restrictions, and whether any detail should be removed.',
  ].filter(Boolean);

  return lines.join('\n');
}

function shareabilityFor(entries: CareEntry[], mode: CareCircleMode): CareCircleUpdate['shareability'] {
  if (mode === 'off') return 'red';
  const sensitive = entries.filter(isSensitive).length;
  if (sensitive >= 2) return 'red';
  if (sensitive === 1 || mode === 'professional_access') return 'amber';
  return 'green';
}

function getClientEntries(client: FullClient) {
  const week = loadWeekData();
  const clientNames = [client.name, client.preferredName].map((name) => name.toLowerCase().trim()).filter(Boolean);
  const diary = week?.clientDiary || {};
  const direct = Object.entries(diary).find(([name]) => clientNames.includes(name.toLowerCase().trim()))?.[1] || [];
  if (direct.length) return direct;
  return Object.values(diary).flat().filter((entry) => clientNames.some((name) => entry.client.toLowerCase().includes(name)));
}

export function CareCirclePanel({ clientId, onBack }: Props) {
  const [clients, setClients] = useState<FullClient[]>(() => loadClients());
  const [copiedId, setCopiedId] = useState('');
  const [contactDraft, setContactDraft] = useState<CareCircleContact>(() => newContact());
  const [concernDraft, setConcernDraft] = useState<CareCircleConcern>(() => newConcern());
  const client = clients.find((item) => item.id === clientId);

  const entries = useMemo(() => client ? getClientEntries(client) : [], [client]);
  const circle = client?.careCircle || emptyCareCircle(client?.reviewDate || todayUk());
  const generatedSummary = client ? buildFamilySummary(client, entries, circle.mode) : '';
  const shareability = shareabilityFor(entries, circle.mode);

  function persist(next: FullClient) {
    saveClient(next);
    setClients(loadClients());
  }

  function updateCircle(patch: Partial<typeof circle>) {
    if (!client) return;
    persist({ ...client, careCircle: { ...circle, ...patch } });
  }

  function newContact(): CareCircleContact {
    return {
      id: uid(),
      name: '',
      relationship: '',
      email: '',
      phone: '',
      permissionLevel: 'reassurance',
      verified: false,
      consentBasis: 'Consent confirmed and recorded by manager.',
      restrictions: '',
      reviewDate: todayUk(),
    };
  }

  function newConcern(): CareCircleConcern {
    return {
      id: uid(),
      type: 'concern',
      source: '',
      detail: '',
      owner: '',
      priority: 'medium',
      status: 'open',
      createdAt: todayIso(),
      response: '',
    };
  }

  async function copyUpdate(update: CareCircleUpdate | null = null) {
    const text = update?.summary || generatedSummary;
    await navigator.clipboard.writeText(text);
    setCopiedId(update?.id || 'draft');
    window.setTimeout(() => setCopiedId(''), 1400);
  }

  function saveGeneratedUpdate() {
    if (!client) return;
    const update: CareCircleUpdate = {
      id: uid(),
      dateFrom: entries[entries.length - 1]?.date || todayUk(),
      dateTo: entries[0]?.date || todayUk(),
      mode: circle.mode,
      status: 'reviewed',
      shareability,
      summary: generatedSummary,
      sourceEntryIds: entries.slice(0, 12).map((entry) => entry.id),
      reviewedBy: client.responsible || client.keyWorker || 'Manager',
      reviewedAt: todayIso(),
      createdAt: todayIso(),
    };
    updateCircle({ updates: [update, ...(circle.updates || [])] });
  }

  function addContact() {
    if (!contactDraft.name.trim()) return;
    updateCircle({ contacts: [contactDraft, ...(circle.contacts || [])] });
    setContactDraft(newContact());
  }

  function removeContact(id: string) {
    updateCircle({ contacts: (circle.contacts || []).filter((contact) => contact.id !== id) });
  }

  function addConcern() {
    if (!concernDraft.detail.trim()) return;
    updateCircle({ concerns: [{ ...concernDraft, createdAt: todayIso() }, ...(circle.concerns || [])] });
    setConcernDraft(newConcern());
  }

  function updateConcern(id: string, patch: Partial<CareCircleConcern>) {
    updateCircle({
      concerns: (circle.concerns || []).map((concern) => concern.id === id ? { ...concern, ...patch } : concern),
    });
  }

  if (!client) {
    return (
      <div className="p-8">
        <button onClick={onBack} className="btn-clay px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest">Back</button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 xl:px-16 2xl:px-24 w-full animate-in fade-in duration-700">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            aria-label="Back to client records"
            title="Back to client records"
            className="w-11 h-11 rounded-2xl hc-clay-raised flex items-center justify-center text-hc-muted hover:text-hc-teal active:hc-clay-pressed"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-hc-text tracking-tight">{client.name}</h1>
              <span className="pill pill-purple text-[9px] font-black uppercase tracking-widest">Care Circle</span>
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-hc-muted mt-1">
              Optional family and professional visibility layer
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(MODE_LABELS) as CareCircleMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => updateCircle({ mode })}
              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${circle.mode === mode ? 'btn-tactical' : 'btn-clay text-hc-muted'}`}
            >
              {MODE_LABELS[mode]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-[1.05fr_0.95fr] gap-6 mb-6">
        <section className="hc-clay-raised rounded-[2rem] p-6 border border-hc-border/20">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="section-header text-[10px] mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-hc-teal" />
                Family-safe update builder
              </div>
              <p className="text-xs text-hc-muted font-medium max-w-2xl leading-relaxed">
                Drafts a shareable update from client evidence. This does not publish externally; a manager reviews, edits, copies, and logs it.
              </p>
            </div>
            <span className={`pill text-[9px] font-black uppercase tracking-widest ${shareability === 'green' ? 'pill-green' : shareability === 'amber' ? 'pill-amber' : 'pill-red'}`}>
              {shareability} shareability
            </span>
          </div>
          <textarea
            value={generatedSummary}
            readOnly
            rows={12}
            className="w-full hc-clay-inset rounded-2xl p-5 text-sm text-hc-text font-medium leading-relaxed resize-y focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button onClick={() => copyUpdate()} className="btn-clay rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <Copy className="w-4 h-4" />
              {copiedId === 'draft' ? 'Copied' : 'Copy Draft'}
            </button>
            <button onClick={saveGeneratedUpdate} className="btn-tactical rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <Save className="w-4 h-4" />
              Save Reviewed Update
            </button>
            <span className="text-[10px] font-bold text-hc-muted uppercase tracking-widest">
              {entries.length} source entries scanned
            </span>
          </div>
        </section>

        <section className="hc-clay-raised rounded-[2rem] p-6 border border-hc-border/20">
          <div className="section-header text-[10px] mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-hc-teal" />
            Consent and boundaries
          </div>
          <textarea
            value={circle.notes || ''}
            onChange={(event) => updateCircle({ notes: event.target.value })}
            rows={6}
            className="w-full hc-clay-inset rounded-2xl p-5 text-sm text-hc-text font-medium leading-relaxed resize-y focus:outline-none mb-4"
            placeholder="Consent, family dynamics, safeguarding restrictions, best-interest decisions, or professional access notes..."
          />
          <div className="grid grid-cols-3 gap-3">
            <div className="hc-clay-inset rounded-2xl p-4">
              <div className="text-xl font-black text-hc-text">{circle.contacts?.length || 0}</div>
              <div className="section-header text-[9px]">Contacts</div>
            </div>
            <div className="hc-clay-inset rounded-2xl p-4">
              <div className="text-xl font-black text-hc-text">{circle.updates?.length || 0}</div>
              <div className="section-header text-[9px]">Updates</div>
            </div>
            <div className="hc-clay-inset rounded-2xl p-4">
              <div className="text-xl font-black text-hc-text">{circle.concerns?.filter((item) => item.status !== 'resolved').length || 0}</div>
              <div className="section-header text-[9px]">Open items</div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
        <section className="hc-clay-raised rounded-[2rem] p-6 border border-hc-border/20">
          <div className="section-header text-[10px] mb-5 flex items-center gap-2">
            <Users className="w-4 h-4 text-hc-teal" />
            Contacts and permissions
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            <input value={contactDraft.name} onChange={(event) => setContactDraft({ ...contactDraft, name: event.target.value })} placeholder="Name" className="hc-clay-inset rounded-xl px-4 py-3 text-sm font-bold text-hc-text focus:outline-none" />
            <input value={contactDraft.relationship} onChange={(event) => setContactDraft({ ...contactDraft, relationship: event.target.value })} placeholder="Relationship" className="hc-clay-inset rounded-xl px-4 py-3 text-sm font-bold text-hc-text focus:outline-none" />
            <input value={contactDraft.email} onChange={(event) => setContactDraft({ ...contactDraft, email: event.target.value })} placeholder="Email" className="hc-clay-inset rounded-xl px-4 py-3 text-sm font-bold text-hc-text focus:outline-none" />
            <input value={contactDraft.phone} onChange={(event) => setContactDraft({ ...contactDraft, phone: event.target.value })} placeholder="Phone" className="hc-clay-inset rounded-xl px-4 py-3 text-sm font-bold text-hc-text focus:outline-none" />
            <select value={contactDraft.permissionLevel} onChange={(event) => setContactDraft({ ...contactDraft, permissionLevel: event.target.value as CareCirclePermissionLevel })} className="hc-clay-inset rounded-xl px-4 py-3 text-sm font-black text-hc-text focus:outline-none">
              {(Object.keys(PERMISSION_LABELS) as CareCirclePermissionLevel[]).map((level) => <option key={level} value={level}>{PERMISSION_LABELS[level]}</option>)}
            </select>
            <input value={contactDraft.reviewDate} onChange={(event) => setContactDraft({ ...contactDraft, reviewDate: event.target.value })} placeholder="Review date" className="hc-clay-inset rounded-xl px-4 py-3 text-sm font-bold text-hc-text focus:outline-none" />
            <textarea value={contactDraft.restrictions} onChange={(event) => setContactDraft({ ...contactDraft, restrictions: event.target.value })} placeholder="Restrictions or boundaries" rows={3} className="md:col-span-2 hc-clay-inset rounded-xl px-4 py-3 text-sm font-bold text-hc-text focus:outline-none" />
          </div>
          <button onClick={addContact} className="btn-tactical rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-5">
            <Plus className="w-4 h-4" />
            Add Contact
          </button>
          <div className="space-y-3">
            {(circle.contacts || []).map((contact) => (
              <div key={contact.id} className="bg-hc-border/10 border border-hc-border/20 rounded-2xl p-4 flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-black text-hc-text">{contact.name}</div>
                  <div className="text-[10px] font-bold text-hc-muted uppercase tracking-widest mt-1">{contact.relationship} / {PERMISSION_LABELS[contact.permissionLevel]}</div>
                  <div className="text-xs text-hc-muted mt-2">{contact.email || contact.phone || 'No contact route recorded'}</div>
                  {contact.restrictions && <div className="text-xs text-flag-amber mt-2 font-bold">{contact.restrictions}</div>}
                </div>
                <button onClick={() => removeContact(contact.id)} className="text-hc-muted hover:text-flag-red transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="hc-clay-raised rounded-[2rem] p-6 border border-hc-border/20">
          <div className="section-header text-[10px] mb-5 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-hc-teal" />
            Concerns, compliments, and questions
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            <select value={concernDraft.type} onChange={(event) => setConcernDraft({ ...concernDraft, type: event.target.value as CareCircleConcern['type'] })} className="hc-clay-inset rounded-xl px-4 py-3 text-sm font-black text-hc-text focus:outline-none">
              <option value="concern">Concern</option>
              <option value="compliment">Compliment</option>
              <option value="question">Question</option>
              <option value="family_update">Family update</option>
            </select>
            <select value={concernDraft.priority} onChange={(event) => setConcernDraft({ ...concernDraft, priority: event.target.value as CareCircleConcern['priority'] })} className="hc-clay-inset rounded-xl px-4 py-3 text-sm font-black text-hc-text focus:outline-none">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <input value={concernDraft.source} onChange={(event) => setConcernDraft({ ...concernDraft, source: event.target.value })} placeholder="Raised by" className="hc-clay-inset rounded-xl px-4 py-3 text-sm font-bold text-hc-text focus:outline-none" />
            <input value={concernDraft.owner} onChange={(event) => setConcernDraft({ ...concernDraft, owner: event.target.value })} placeholder="Owner" className="hc-clay-inset rounded-xl px-4 py-3 text-sm font-bold text-hc-text focus:outline-none" />
            <textarea value={concernDraft.detail} onChange={(event) => setConcernDraft({ ...concernDraft, detail: event.target.value })} placeholder="What was raised?" rows={4} className="md:col-span-2 hc-clay-inset rounded-xl px-4 py-3 text-sm font-bold text-hc-text focus:outline-none" />
          </div>
          <button onClick={addConcern} className="btn-tactical rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-5">
            <Plus className="w-4 h-4" />
            Log Item
          </button>
          <div className="space-y-3">
            {(circle.concerns || []).map((concern) => (
              <div key={concern.id} className="bg-hc-border/10 border border-hc-border/20 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-black text-hc-text uppercase">{concern.type.replace('_', ' ')}</div>
                    <div className="text-[10px] font-bold text-hc-muted uppercase tracking-widest mt-1">{concern.priority} / {concern.source || 'No source'} / {new Date(concern.createdAt).toLocaleDateString('en-GB')}</div>
                  </div>
                  <select value={concern.status} onChange={(event) => updateConcern(concern.id, { status: event.target.value as CareCircleConcern['status'] })} className="hc-clay-inset rounded-xl px-3 py-2 text-[10px] font-black text-hc-text focus:outline-none">
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
                <p className="text-xs text-hc-text/80 leading-relaxed mt-3">{concern.detail}</p>
                <textarea value={concern.response} onChange={(event) => updateConcern(concern.id, { response: event.target.value })} placeholder="Response/actions taken..." rows={2} className="mt-3 w-full hc-clay-inset rounded-xl px-4 py-3 text-xs font-bold text-hc-text focus:outline-none" />
              </div>
            ))}
          </div>
        </section>
      </div>

      {(circle.updates || []).length > 0 && (
        <section className="hc-clay-raised rounded-[2rem] p-6 border border-hc-border/20 mt-6">
          <div className="section-header text-[10px] mb-5 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-hc-teal" />
            Reviewed update history
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {circle.updates.map((update) => (
              <div key={update.id} className="bg-hc-border/10 border border-hc-border/20 rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className={`pill text-[9px] font-black uppercase tracking-widest ${update.shareability === 'green' ? 'pill-green' : update.shareability === 'amber' ? 'pill-amber' : 'pill-red'}`}>{update.shareability}</span>
                  <button onClick={() => copyUpdate(update)} className="text-[10px] font-black uppercase tracking-widest text-hc-muted hover:text-hc-teal flex items-center gap-2">
                    <Copy className="w-3 h-3" />
                    {copiedId === update.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap text-xs leading-relaxed text-hc-text/80 font-sans">{update.summary}</pre>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
