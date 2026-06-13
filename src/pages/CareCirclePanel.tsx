import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle, Copy, FileText, Link2, MessageSquare, Plus, Printer, Save, ShieldCheck, Sparkles, Trash2, Users } from 'lucide-react';
import {
  emptyCareCircle,
  loadClients,
  saveClient,
  type CareCircleActivity,
  type CareCircleConcern,
  type CareCircleContact,
  type CareCircleMode,
  type CareCirclePermissionLevel,
  type CareCircleUpdate,
  type FullClient,
} from '../lib/client-store';
import { loadActions, loadWeekData, saveActions, uid } from '../lib/storage';
import type { Action, ActionPriority, CareEntry } from '../lib/types';

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

const PERMISSION_RANK: Record<CareCirclePermissionLevel, number> = {
  reassurance: 1,
  care_plan: 2,
  risk_aware: 3,
  professional: 4,
};

type ShareAudience = CareCirclePermissionLevel;

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

function escapeHtml(input: string | undefined) {
  return (input || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function asParagraphs(input: string | undefined) {
  return escapeHtml(input).split(/\n{2,}/).map((part) => `<p>${part.replace(/\n/g, '<br/>')}</p>`).join('');
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function actorFor(client: FullClient) {
  return client.responsible || client.keyWorker || client.completedBy || 'Manager';
}

function parseReviewDate(value: string) {
  const parts = value.split(/[/-]/).map((part) => part.trim());
  if (parts.length === 3) {
    const [d, m, y] = parts.map(Number);
    if (d && m && y) return new Date(y < 100 ? y + 2000 : y, m - 1, d).getTime();
  }
  return Date.parse(value) || 0;
}

function contactExpired(contact: CareCircleContact) {
  const date = parseReviewDate(contact.reviewDate || '');
  return !!date && date < Date.now() - 24 * 60 * 60 * 1000;
}

function contactHasRoute(contact: CareCircleContact) {
  return Boolean(contact.email.trim() || contact.phone.trim());
}

function contactAllowed(contact: CareCircleContact, audience: ShareAudience) {
  return PERMISSION_RANK[contact.permissionLevel] >= PERMISSION_RANK[audience];
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

function sourceRef(entry: CareEntry) {
  const bits = [entry.date, entry.time, entry.house, entry.type].filter(Boolean).join(' / ');
  return `${bits || 'Care entry'}: ${cleanLine(entry.entry, 170)}`;
}

function clientEvidenceRefs(client: FullClient) {
  const refs: string[] = [];
  const domains = client.carePlan?.domains?.filter((domain) => domain.enabled) || [];
  for (const domain of domains.slice(0, 8)) {
    const detail = cleanLine(domain.identifiedNeed || domain.howToSupport || domain.desiredOutcome || domain.riskNotes, 170);
    refs.push(`Care plan / ${domain.title}: ${detail || 'Domain enabled for support planning.'}`);
  }
  if (client.supportPlan?.needs?.length) {
    for (const need of client.supportPlan.needs.slice(0, 6)) {
      refs.push(`Support plan / ${need.area}: ${cleanLine(need.need || need.howToSupport || need.outcome, 170)}`);
    }
  }
  if (client.clinicalBriefing) refs.push(`Clinical briefing: ${cleanLine(client.clinicalBriefing, 190)}`);
  if (client.vaultDocs?.length) {
    for (const doc of client.vaultDocs.slice(0, 4)) refs.push(`Evidence vault / ${doc.name}: ${cleanLine(doc.text, 170)}`);
  }
  return refs.filter(Boolean);
}

function dueDateFor(priority: CareCircleConcern['priority']) {
  if (priority === 'critical') return addDays(1);
  if (priority === 'high') return addDays(3);
  if (priority === 'medium') return addDays(7);
  return addDays(14);
}

function actionPriorityFor(priority: CareCircleConcern['priority']): ActionPriority {
  return priority === 'critical' ? 'critical' : priority === 'high' ? 'high' : priority === 'medium' ? 'medium' : 'low';
}

function latestReviewedUpdate(updates: CareCircleUpdate[] | undefined) {
  return (updates || []).find((update) => update.status === 'reviewed' || update.status === 'shared') || null;
}

function sharePackText(client: FullClient, circle: ReturnType<typeof emptyCareCircle>, audience: ShareAudience) {
  const update = latestReviewedUpdate(circle.updates);
  const contacts = (circle.contacts || []).filter((contact) => contactAllowed(contact, audience));
  const openItems = (circle.concerns || []).filter((item) => item.status !== 'resolved').slice(0, 6);
  const lines = [
    `Care Circle Pack - ${client.name}`,
    `Audience: ${PERMISSION_LABELS[audience]}`,
    `Generated: ${todayUk()}`,
    `Mode: ${MODE_LABELS[circle.mode]}`,
    '',
    'Reviewed Update',
    update?.summary || 'No reviewed update has been saved yet.',
    '',
    'Sharing Controls',
    `Approved contacts in scope: ${contacts.length}`,
    ...contacts.map((contact) => `- ${contact.name} (${contact.relationship || 'relationship not recorded'}): ${PERMISSION_LABELS[contact.permissionLevel]}${contact.verified ? ', verified' : ', not verified'}${contactExpired(contact) ? ', review expired' : ''}`),
    circle.notes ? `Boundaries: ${circle.notes}` : '',
    '',
    'Open Family Items',
    openItems.length ? openItems.map((item) => `- ${item.type.replace('_', ' ')} / ${item.priority} / ${item.status}: ${item.detail}`).join('\n') : 'No open Care Circle items.',
  ].filter(Boolean);
  return lines.join('\n');
}

function sharePackHtml(client: FullClient, circle: ReturnType<typeof emptyCareCircle>, audience: ShareAudience) {
  const update = latestReviewedUpdate(circle.updates);
  const contacts = (circle.contacts || []).filter((contact) => contactAllowed(contact, audience));
  const openItems = (circle.concerns || []).filter((item) => item.status !== 'resolved').slice(0, 6);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Care Circle Pack - ${escapeHtml(client.name)}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Inter, Arial, sans-serif; color: #163434; margin: 0; line-height: 1.45; }
    h1 { font-size: 24px; margin: 0 0 4px; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .14em; margin: 24px 0 8px; color: #5d0565; }
    .meta { color: #667; font-size: 11px; text-transform: uppercase; letter-spacing: .12em; }
    .box { border: 1px solid #d7d0bf; border-radius: 12px; padding: 14px; margin-top: 10px; break-inside: avoid; }
    .pill { display: inline-block; border: 1px solid #d7d0bf; border-radius: 999px; padding: 4px 8px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; margin: 3px 4px 3px 0; }
    p, li { font-size: 12px; }
    .footer { margin-top: 28px; border-top: 1px solid #d7d0bf; padding-top: 10px; font-size: 10px; color: #667; }
  </style>
</head>
<body>
  <h1>Care Circle Pack</h1>
  <div class="meta">${escapeHtml(client.name)} / ${escapeHtml(PERMISSION_LABELS[audience])} / ${escapeHtml(todayUk())}</div>
  <div class="box">
    <span class="pill">Mode: ${escapeHtml(MODE_LABELS[circle.mode])}</span>
    <span class="pill">Contacts in scope: ${contacts.length}</span>
    <span class="pill">Open items: ${openItems.length}</span>
  </div>
  <h2>Reviewed Update</h2>
  <div class="box">${update ? asParagraphs(update.summary) : '<p>No reviewed update has been saved yet.</p>'}</div>
  <h2>Sharing Controls</h2>
  <div class="box">
    <ul>
      ${contacts.length ? contacts.map((contact) => `<li><strong>${escapeHtml(contact.name)}</strong> - ${escapeHtml(contact.relationship || 'relationship not recorded')} / ${escapeHtml(PERMISSION_LABELS[contact.permissionLevel])} / ${contact.verified ? 'verified' : 'not verified'}${contactExpired(contact) ? ' / review expired' : ''}</li>`).join('') : '<li>No contacts are currently in scope for this permission level.</li>'}
    </ul>
    ${circle.notes ? `<p><strong>Boundaries:</strong> ${escapeHtml(circle.notes)}</p>` : ''}
  </div>
  <h2>Open Family Items</h2>
  <div class="box">
    <ul>
      ${openItems.length ? openItems.map((item) => `<li><strong>${escapeHtml(item.type.replace('_', ' '))}</strong> / ${escapeHtml(item.priority)} / ${escapeHtml(item.status)}: ${escapeHtml(item.detail)}</li>`).join('') : '<li>No open Care Circle items.</li>'}
    </ul>
  </div>
  <div class="footer">Manager reviewed pack. Internal evidence references remain in Care Ops and are not printed for family-facing circulation unless separately authorised.</div>
</body>
</html>`;
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
  const [reviewDraft, setReviewDraft] = useState('');
  const [shareAudience, setShareAudience] = useState<ShareAudience>('reassurance');
  const [contactDraft, setContactDraft] = useState<CareCircleContact>(() => newContact());
  const [concernDraft, setConcernDraft] = useState<CareCircleConcern>(() => newConcern());
  const client = clients.find((item) => item.id === clientId);

  const entries = useMemo(() => client ? getClientEntries(client) : [], [client]);
  const circle = client?.careCircle || emptyCareCircle(client?.reviewDate || todayUk());
  const generatedSummary = client ? buildFamilySummary(client, entries, circle.mode) : '';
  const shareability = shareabilityFor(entries, circle.mode);
  const sourceRefs = [...entries.slice(0, 12).map(sourceRef), ...(client ? clientEvidenceRefs(client) : [])].slice(0, 16);
  const latestUpdate = latestReviewedUpdate(circle.updates);
  const contactsInScope = (circle.contacts || []).filter((contact) => contactAllowed(contact, shareAudience));
  const verifiedInScope = contactsInScope.filter((contact) => contact.verified && contactHasRoute(contact) && !contactExpired(contact));
  const readinessIssues = [
    circle.mode === 'off' ? 'Care Circle mode is Off.' : '',
    !latestUpdate ? 'No reviewed update has been saved yet.' : '',
    contactsInScope.length === 0 ? `No ${PERMISSION_LABELS[shareAudience]} contacts are in scope.` : '',
    contactsInScope.some((contact) => !contact.verified) ? 'One or more contacts need verification.' : '',
    contactsInScope.some((contact) => !contactHasRoute(contact)) ? 'One or more contacts have no email or phone route.' : '',
    contactsInScope.some(contactExpired) ? 'One or more contacts have an expired review date.' : '',
  ].filter(Boolean);
  const shareReady = readinessIssues.length === 0;

  useEffect(() => {
    setReviewDraft(generatedSummary);
  }, [generatedSummary]);

  function persist(next: FullClient) {
    saveClient(next);
    setClients(loadClients());
  }

  function updateCircle(patch: Partial<typeof circle>) {
    if (!client) return;
    persist({ ...client, careCircle: { ...circle, ...patch } });
  }

  function activity(type: CareCircleActivity['type'], label: string, detail: string, refId?: string): CareCircleActivity {
    return {
      id: uid(),
      type,
      label,
      detail,
      refId,
      actor: client ? actorFor(client) : 'Manager',
      createdAt: todayIso(),
    };
  }

  function updateCircleWithActivity(patch: Partial<typeof circle>, item: CareCircleActivity) {
    if (!client) return;
    const latestClient = loadClients().find((storedClient) => storedClient.id === client.id) || client;
    const latestCircle = latestClient.careCircle || circle;
    persist({
      ...latestClient,
      careCircle: {
        ...latestCircle,
      ...patch,
        activity: [item, ...(latestCircle.activity || [])],
      },
    });
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
      dueDate: dueDateFor('medium'),
    };
  }

  async function copyUpdate(update: CareCircleUpdate | null = null) {
    const text = update?.summary || reviewDraft || generatedSummary;
    await navigator.clipboard.writeText(text);
    setCopiedId(update?.id || 'draft');
    if (client) {
      if (update) {
        updateCircleWithActivity(
          {
            updates: (circle.updates || []).map((item) => item.id === update.id ? { ...item, status: 'shared' } : item),
          },
          activity('update_copied', 'Reviewed update copied', `${client.name} update copied for controlled sharing.`, update.id)
        );
      } else {
        updateCircleWithActivity({}, activity('update_copied', 'Draft update copied', `${client.name} draft copied before saving.`));
      }
    }
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
      summary: reviewDraft || generatedSummary,
      sourceEntryIds: entries.slice(0, 12).map((entry) => entry.id),
      sourceRefs,
      reviewedBy: actorFor(client),
      reviewedAt: todayIso(),
      createdAt: todayIso(),
    };
    updateCircleWithActivity(
      { updates: [update, ...(circle.updates || [])] },
      activity('update_generated', 'Reviewed update saved', `${sourceRefs.length} source references retained internally.`, update.id)
    );
  }

  function setMode(mode: CareCircleMode) {
    if (!client || mode === circle.mode) return;
    updateCircleWithActivity(
      { mode },
      activity('mode_changed', 'Care Circle mode changed', `${MODE_LABELS[circle.mode]} -> ${MODE_LABELS[mode]}`)
    );
  }

  function addContact() {
    if (!contactDraft.name.trim()) return;
    updateCircleWithActivity(
      { contacts: [contactDraft, ...(circle.contacts || [])] },
      activity('contact_added', 'Contact added', `${contactDraft.name} added as ${PERMISSION_LABELS[contactDraft.permissionLevel]}.`, contactDraft.id)
    );
    setContactDraft(newContact());
  }

  function removeContact(id: string) {
    updateCircle({ contacts: (circle.contacts || []).filter((contact) => contact.id !== id) });
  }

  function updateContact(id: string, patch: Partial<CareCircleContact>) {
    updateCircle({
      contacts: (circle.contacts || []).map((contact) => contact.id === id ? { ...contact, ...patch } : contact),
    });
  }

  function addConcern() {
    if (!client || !concernDraft.detail.trim()) return;
    const concern: CareCircleConcern = { ...concernDraft, createdAt: todayIso(), dueDate: concernDraft.dueDate || dueDateFor(concernDraft.priority) };
    const action: Action = {
      id: uid(),
      title: `${concern.type.replace('_', ' ')} - ${client.name}`,
      description: [
        concern.detail,
        concern.source ? `Raised by: ${concern.source}` : '',
        concern.response ? `Initial response: ${concern.response}` : '',
      ].filter(Boolean).join('\n'),
      house: 'Client Care',
      owner: concern.owner || actorFor(client),
      priority: actionPriorityFor(concern.priority),
      status: 'open',
      createdAt: todayIso(),
      dueDate: concern.dueDate || '',
      sourceEntry: `care-circle:${client.id}:${concern.id}`,
      tags: ['care-circle', concern.type, client.name],
    };
    const linkedConcern = { ...concern, actionId: action.id };
    saveActions([action, ...loadActions()]);
    updateCircleWithActivity(
      { concerns: [linkedConcern, ...(circle.concerns || [])] },
      activity('concern_logged', 'Care Circle item logged', `Internal action created for ${concern.type.replace('_', ' ')}.`, linkedConcern.id)
    );
    setConcernDraft(newConcern());
  }

  function updateConcern(id: string, patch: Partial<CareCircleConcern>) {
    const prior = (circle.concerns || []).find((concern) => concern.id === id);
    const statusChanged = patch.status && prior && patch.status !== prior.status;
    updateCircle({
      concerns: (circle.concerns || []).map((concern) => concern.id === id ? { ...concern, ...patch } : concern),
      activity: statusChanged
        ? [activity('status_changed', 'Care Circle item status changed', `${prior.type.replace('_', ' ')} moved to ${patch.status}.`, id), ...(circle.activity || [])]
        : circle.activity,
    });
  }

  async function copySharePack() {
    if (!client) return;
    await navigator.clipboard.writeText(sharePackText(client, circle, shareAudience));
    setCopiedId('share-pack');
    updateCircleWithActivity(
      {},
      activity('share_pack_copied', 'Share pack copied', `${PERMISSION_LABELS[shareAudience]} pack copied for ${client.name}.`)
    );
    window.setTimeout(() => setCopiedId(''), 1400);
  }

  function printSharePack() {
    if (!client) return;
    const win = window.open('', '_blank', 'width=900,height=1200');
    if (!win) return;
    win.document.open();
    win.document.write(sharePackHtml(client, circle, shareAudience));
    win.document.close();
    win.focus();
    window.setTimeout(() => win.print(), 300);
    updateCircleWithActivity(
      {},
      activity('share_pack_printed', 'Share pack printed', `${PERMISSION_LABELS[shareAudience]} pack printed for ${client.name}.`)
    );
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
              onClick={() => setMode(mode)}
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
            value={reviewDraft}
            onChange={(event) => setReviewDraft(event.target.value)}
            rows={12}
            className="w-full hc-clay-inset rounded-2xl p-5 text-sm text-hc-text font-medium leading-relaxed resize-y focus:outline-none"
          />
          <div className="mt-4 rounded-2xl border border-hc-border/20 bg-hc-border/10 p-4">
            <div className="section-header text-[9px] mb-3 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-hc-teal" />
              Internal source evidence retained
            </div>
            {sourceRefs.length ? (
              <ul className="space-y-2 max-h-36 overflow-auto pr-2">
                {sourceRefs.map((ref, idx) => (
                  <li key={`${ref}-${idx}`} className="text-[11px] text-hc-muted font-bold leading-relaxed">
                    {idx + 1}. {ref}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-hc-muted font-bold">No diary source entries are currently loaded for this person.</p>
            )}
          </div>
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

      <section className="hc-clay-raised rounded-[2rem] p-6 border border-hc-border/20 mb-6">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
          <div>
            <div className="section-header text-[10px] mb-2 flex items-center gap-2">
              <Printer className="w-4 h-4 text-hc-teal" />
              Permission-aware share pack
            </div>
            <p className="text-xs text-hc-muted font-medium max-w-3xl leading-relaxed">
              Builds a controlled family or professional pack from the latest reviewed update. Internal evidence references stay inside Care Ops unless separately authorised.
            </p>
          </div>
          <div className={`pill text-[9px] font-black uppercase tracking-widest ${shareReady ? 'pill-green' : 'pill-amber'}`}>
            {shareReady ? 'Ready to share' : `${readinessIssues.length} checks`}
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-5 mt-5">
          <div className="space-y-3">
            <select
              value={shareAudience}
              onChange={(event) => setShareAudience(event.target.value as ShareAudience)}
              className="w-full hc-clay-inset rounded-xl px-4 py-3 text-sm font-black text-hc-text focus:outline-none"
              aria-label="Share pack audience"
            >
              {(Object.keys(PERMISSION_LABELS) as ShareAudience[]).map((level) => (
                <option key={level} value={level}>{PERMISSION_LABELS[level]}</option>
              ))}
            </select>
            <button onClick={copySharePack} className="w-full btn-clay rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
              <Copy className="w-4 h-4" />
              {copiedId === 'share-pack' ? 'Copied' : 'Copy Pack'}
            </button>
            <button onClick={printSharePack} className="w-full btn-tactical rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
              <Printer className="w-4 h-4" />
              Print Pack
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="hc-clay-inset rounded-2xl p-4">
              <div className="text-xl font-black text-hc-text">{contactsInScope.length}</div>
              <div className="section-header text-[9px]">In scope</div>
            </div>
            <div className="hc-clay-inset rounded-2xl p-4">
              <div className="text-xl font-black text-hc-text">{verifiedInScope.length}</div>
              <div className="section-header text-[9px]">Verified</div>
            </div>
            <div className="hc-clay-inset rounded-2xl p-4">
              <div className="text-xl font-black text-hc-text">{latestUpdate ? '1' : '0'}</div>
              <div className="section-header text-[9px]">Reviewed update</div>
            </div>
            <div className="lg:col-span-3 rounded-2xl border border-hc-border/20 bg-hc-border/10 p-4">
              {readinessIssues.length ? (
                <ul className="space-y-2">
                  {readinessIssues.map((issue) => (
                    <li key={issue} className="text-[11px] font-bold text-flag-amber">{issue}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] font-bold text-hc-teal">All checks passed for this audience. Review the pack before external circulation.</p>
              )}
            </div>
          </div>
        </div>
      </section>

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
            <label className="hc-clay-inset rounded-xl px-4 py-3 text-sm font-black text-hc-text focus:outline-none flex items-center gap-3">
              <input
                type="checkbox"
                checked={contactDraft.verified}
                onChange={(event) => setContactDraft({ ...contactDraft, verified: event.target.checked })}
                className="accent-hc-teal"
              />
              Verified contact
            </label>
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
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className={`pill text-[8px] font-black uppercase tracking-widest ${contact.verified ? 'pill-green' : 'pill-amber'}`}>
                      {contact.verified ? 'Verified' : 'Unverified'}
                    </span>
                    {contactExpired(contact) && <span className="pill pill-red text-[8px] font-black uppercase tracking-widest">Review expired</span>}
                    {!contactHasRoute(contact) && <span className="pill pill-amber text-[8px] font-black uppercase tracking-widest">No route</span>}
                  </div>
                  {contact.restrictions && <div className="text-xs text-flag-amber mt-2 font-bold">{contact.restrictions}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateContact(contact.id, { verified: !contact.verified })} className="text-[9px] font-black uppercase tracking-widest text-hc-muted hover:text-hc-teal transition-colors">
                    {contact.verified ? 'Unverify' : 'Verify'}
                  </button>
                  <button onClick={() => removeContact(contact.id)} className="text-hc-muted hover:text-flag-red transition-colors" aria-label={`Remove ${contact.name}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
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
            <input value={concernDraft.dueDate || ''} onChange={(event) => setConcernDraft({ ...concernDraft, dueDate: event.target.value })} placeholder="Due date" className="hc-clay-inset rounded-xl px-4 py-3 text-sm font-bold text-hc-text focus:outline-none" />
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
                    <div className="text-[10px] font-bold text-hc-muted uppercase tracking-widest mt-1">{concern.priority} / {concern.source || 'No source'} / due {concern.dueDate || 'unset'}</div>
                  </div>
                  <select value={concern.status} onChange={(event) => updateConcern(concern.id, { status: event.target.value as CareCircleConcern['status'] })} className="hc-clay-inset rounded-xl px-3 py-2 text-[10px] font-black text-hc-text focus:outline-none">
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
                <p className="text-xs text-hc-text/80 leading-relaxed mt-3">{concern.detail}</p>
                {concern.actionId && (
                  <div className="mt-3 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-hc-teal">
                    <Link2 className="w-3 h-3" />
                    Action linked
                  </div>
                )}
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
                {update.sourceRefs && update.sourceRefs.length > 0 && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-hc-teal">Internal evidence refs</summary>
                    <ul className="mt-3 space-y-2">
                      {update.sourceRefs.map((ref, idx) => (
                        <li key={`${update.id}-${idx}`} className="text-[11px] text-hc-muted font-bold leading-relaxed">{idx + 1}. {ref}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {(circle.activity || []).length > 0 && (
        <section className="hc-clay-raised rounded-[2rem] p-6 border border-hc-border/20 mt-6">
          <div className="section-header text-[10px] mb-5 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-hc-teal" />
            Care Circle activity log
          </div>
          <div className="space-y-3">
            {(circle.activity || []).map((item) => (
              <div key={item.id} className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3 rounded-2xl border border-hc-border/20 bg-hc-border/10 p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-hc-muted">
                  {new Date(item.createdAt).toLocaleString('en-GB')}
                </div>
                <div>
                  <div className="text-sm font-black text-hc-text">{item.label}</div>
                  <div className="text-xs font-bold text-hc-muted mt-1">{item.detail}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-hc-muted/70 mt-2">{item.actor}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
