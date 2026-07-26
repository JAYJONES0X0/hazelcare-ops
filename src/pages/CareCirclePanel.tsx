import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle, Copy, FileText, Link2, LockKeyhole, MessageSquare, Plus, Printer, Save, ShieldCheck, Sparkles, Trash2, Users } from 'lucide-react';
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
import { getAllEntriesAsync } from '../lib/entry-store';
import { loadActions, loadWeekData, saveActions, uid } from '../lib/storage';
import type { Action, ActionPriority, CareEntry } from '../lib/types';
import { syncCareCircleLinkedAction } from '../lib/care-circle-action-sync';
import { buildCareCircleInternalDraftText } from '../lib/care-circle-draft-copy';
import { mergeCareCircleEvidenceEntries } from '../lib/care-circle-evidence';
import {
  buildCareCircleFamilyDigest,
  careCircleClientEvidenceRefs,
  careCircleDigestShareability,
  careCircleEntrySourceRef,
} from '../lib/care-circle-family-digest';
import { getCareCircleOperationalInsight } from '../lib/care-circle-insights';
import { buildCareCircleFamilyResponseText, getCareCircleResponseStatus } from '../lib/care-circle-response';
import {
  buildCareCircleSharePackHtml,
  buildCareCircleSharePackText,
  canReleaseCareCircleSharePack,
  careCircleConcernTypeLabel,
  careCircleContactAllowed,
  careCircleContactHasRoute,
  careCirclePermissionLabel,
  getCareCircleShareReadiness,
  latestReviewedCareCircleUpdate,
} from '../lib/care-circle-share-pack';
import { careCircleModeLabel, isCareCircleContactExpired } from '../lib/care-circle-status';

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

type ShareAudience = CareCirclePermissionLevel;

function todayIso() {
  return new Date().toISOString();
}

function todayUk() {
  return new Date().toLocaleDateString('en-GB');
}

function modeLabel(mode?: CareCircleMode) {
  return (mode && MODE_LABELS[mode]) || careCircleModeLabel(mode);
}

function permissionLabel(level?: CareCirclePermissionLevel) {
  return (level && PERMISSION_LABELS[level]) || careCirclePermissionLabel(level);
}

function concernTypeLabel(type?: CareCircleConcern['type']) {
  return careCircleConcernTypeLabel(type);
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function actorFor(client: FullClient) {
  return client.responsible || client.keyWorker || client.completedBy || 'Manager';
}

function contactExpired(contact: CareCircleContact) {
  return isCareCircleContactExpired(contact.reviewDate || '');
}

function contactHasRoute(contact: CareCircleContact) {
  return careCircleContactHasRoute(contact);
}

function contactAllowed(contact: CareCircleContact, audience: ShareAudience) {
  return careCircleContactAllowed(contact, audience);
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

function createContactDraft(): CareCircleContact {
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

function createConcernDraft(): CareCircleConcern {
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

export function CareCirclePanel({ clientId, onBack }: Props) {
  const [clients, setClients] = useState<FullClient[]>(() => loadClients());
  const [copiedId, setCopiedId] = useState('');
  const [reviewDraft, setReviewDraft] = useState('');
  const [shareAudience, setShareAudience] = useState<ShareAudience>('reassurance');
  const [shareOverride, setShareOverride] = useState(false);
  const [storedEntries, setStoredEntries] = useState<CareEntry[]>([]);
  const [entryStoreLoaded, setEntryStoreLoaded] = useState(false);
  const [contactDraft, setContactDraft] = useState<CareCircleContact>(() => createContactDraft());
  const [concernDraft, setConcernDraft] = useState<CareCircleConcern>(() => createConcernDraft());
  const client = clients.find((item) => item.id === clientId);

  useEffect(() => {
    let cancelled = false;
    setEntryStoreLoaded(false);
    getAllEntriesAsync()
      .then((rows) => {
        if (!cancelled) setStoredEntries(rows);
      })
      .catch(() => {
        if (!cancelled) setStoredEntries([]);
      })
      .finally(() => {
        if (!cancelled) setEntryStoreLoaded(true);
      });
    return () => { cancelled = true; };
  }, [clientId]);

  const entries = useMemo(() => client ? mergeCareCircleEvidenceEntries(client, loadWeekData(), storedEntries) : [], [client, storedEntries]);
  const circle = client?.careCircle || emptyCareCircle(client?.reviewDate || todayUk());
  const generatedSummary = client ? buildCareCircleFamilyDigest(client, entries, circle.mode) : '';
  const shareability = careCircleDigestShareability(entries, circle.mode);
  const sourceRefs = [...entries.slice(0, 12).map(careCircleEntrySourceRef), ...(client ? careCircleClientEvidenceRefs(client) : [])].slice(0, 16);
  const latestUpdate = latestReviewedCareCircleUpdate(circle.updates);
  const contactsInScope = (circle.contacts || []).filter((contact) => contactAllowed(contact, shareAudience));
  const verifiedInScope = contactsInScope.filter((contact) => contact.verified && contactHasRoute(contact) && !contactExpired(contact));
  const shareReadiness = getCareCircleShareReadiness(circle, shareAudience);
  const readinessIssues = shareReadiness.issues;
  const shareReady = shareReadiness.ready;
  const careCircleEnabled = circle.mode !== 'off';
  const contacts = circle.contacts || [];
  const verifiedContacts = contacts.filter((contact) => contact.verified && contactHasRoute(contact) && !contactExpired(contact));
  const openItems = (circle.concerns || []).filter((item) => item.status !== 'resolved');
  const evidenceSourceCount = sourceRefs.length;
  const shareOverrideAvailable = careCircleEnabled && !shareReady && canReleaseCareCircleSharePack(shareReadiness, true);
  const canReleaseSharePack = careCircleEnabled && canReleaseCareCircleSharePack(shareReadiness, shareOverride);
  const circleInsight = getCareCircleOperationalInsight(circle, shareReadiness);
  const activationIssues = [
    !careCircleEnabled ? 'Choose a visibility mode before any family or professional pack can leave OVSITE.' : '',
    !verifiedContacts.length ? 'Add and verify at least one contact with a safe contact route.' : '',
    !evidenceSourceCount ? 'No reviewed source evidence is available for a share-ready update yet.' : '',
  ].filter(Boolean);

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

  async function copyUpdate(update: CareCircleUpdate | null = null) {
    if (!update && !careCircleEnabled) return;
    const draftText = reviewDraft || generatedSummary;
    const text = update?.summary || buildCareCircleInternalDraftText({
      clientName: client?.name || '',
      draft: draftText,
      sourceCount: entries.length,
      shareability,
    });
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
        updateCircleWithActivity({}, activity('update_copied', 'Internal draft copied', `${client.name} draft copied for manager review only.`));
      }
    }
    window.setTimeout(() => setCopiedId(''), 1400);
  }

  function saveGeneratedUpdate() {
    if (!client || !careCircleEnabled) return;
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
      activity('mode_changed', 'Care Circle mode changed', `${modeLabel(circle.mode)} -> ${modeLabel(mode)}`)
    );
  }

  function addContact() {
    if (!contactDraft.name.trim()) return;
    updateCircleWithActivity(
      { contacts: [contactDraft, ...(circle.contacts || [])] },
      activity('contact_added', 'Contact added', `${contactDraft.name} added as ${permissionLabel(contactDraft.permissionLevel)}.`, contactDraft.id)
    );
    setContactDraft(createContactDraft());
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
      title: `${concernTypeLabel(concern.type)} - ${client.name}`,
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
      activity('concern_logged', 'Care Circle item logged', `Internal action created for ${concernTypeLabel(concern.type)}.`, linkedConcern.id)
    );
    setConcernDraft(createConcernDraft());
  }

  function updateConcern(id: string, patch: Partial<CareCircleConcern>) {
    const prior = (circle.concerns || []).find((concern) => concern.id === id);
    const statusChanged = patch.status && prior && patch.status !== prior.status;
    if (statusChanged && prior?.actionId) {
      saveActions(syncCareCircleLinkedAction(loadActions(), prior.actionId, patch.status!, todayIso()));
    }
    updateCircle({
      concerns: (circle.concerns || []).map((concern) => concern.id === id ? { ...concern, ...patch } : concern),
      activity: statusChanged
        ? [activity('status_changed', 'Care Circle item status changed', `${concernTypeLabel(prior.type)} moved to ${patch.status}.`, id), ...(circle.activity || [])]
        : circle.activity,
    });
  }

  async function copyConcernResponse(concern: CareCircleConcern) {
    if (!client) return;
    const status = getCareCircleResponseStatus(concern);
    if (!status.canCopy) return;
    await navigator.clipboard.writeText(buildCareCircleFamilyResponseText(client.name, concern));
    setCopiedId(`response-${concern.id}`);
    updateCircleWithActivity(
      {},
      activity('response_copied', 'Family response copied', `${concernTypeLabel(concern.type)} response copied for ${client.name}.`, concern.id)
    );
    window.setTimeout(() => setCopiedId(''), 1400);
  }

  function resolveConcernWithResponse(concern: CareCircleConcern) {
    const status = getCareCircleResponseStatus(concern);
    if (!status.canResolve) return;
    updateConcern(concern.id, { status: 'resolved' });
  }

  async function copySharePack() {
    if (!client || !canReleaseSharePack) return;
    await navigator.clipboard.writeText(buildCareCircleSharePackText(client, circle, shareAudience, { managerOverride: !shareReady }));
    setCopiedId('share-pack');
    updateCircleWithActivity(
      {},
      activity('share_pack_copied', 'Share pack copied', `${permissionLabel(shareAudience)} pack copied for ${client.name}.${shareReady ? '' : ' Manager override recorded for blocked checks.'}`)
    );
    window.setTimeout(() => setCopiedId(''), 1400);
  }

  function printSharePack() {
    if (!client || !canReleaseSharePack) return;
    const win = window.open('', '_blank', 'width=900,height=1200');
    if (!win) return;
    win.document.open();
    win.document.write(buildCareCircleSharePackHtml(client, circle, shareAudience, { managerOverride: !shareReady }));
    win.document.close();
    win.focus();
    window.setTimeout(() => win.print(), 300);
    updateCircleWithActivity(
      {},
      activity('share_pack_printed', 'Share pack printed', `${permissionLabel(shareAudience)} pack printed for ${client.name}.${shareReady ? '' : ' Manager override recorded for blocked checks.'}`)
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
              {careCircleEnabled ? 'Optional family and professional visibility layer' : 'Off: setup only, no external sharing'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-start xl:justify-end">
          {(Object.keys(MODE_LABELS) as CareCircleMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setMode(mode)}
              className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${circle.mode === mode ? 'btn-tactical' : 'btn-clay text-hc-muted'}`}
            >
              {modeLabel(mode)}
            </button>
          ))}
        </div>
      </div>

      {!careCircleEnabled && (
        <section className="hc-clay-raised rounded-[2rem] p-5 border border-hc-teal/20 mb-6">
          <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-teal shrink-0">
                <LockKeyhole className="w-5 h-5" />
              </div>
              <div>
                <div className="section-header text-[10px] mb-2">Care Circle is switched off</div>
                <p className="text-sm font-bold text-hc-text leading-relaxed max-w-4xl">
                  This is a preparation area only. You can add contacts, record consent boundaries, and log family/professional queries, but no family update or share pack can be copied or printed until a manager chooses a visibility mode and passes the gates.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {activationIssues.map((issue) => (
                    <span key={issue} className="pill pill-amber text-[8px] font-black uppercase tracking-widest">{issue}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['light_reassurance', 'standard_family_window', 'collaborative', 'professional_access'] as CareCircleMode[]).map((mode) => (
                <button
                  key={`enable-${mode}`}
                  onClick={() => setMode(mode)}
                  className="btn-clay rounded-xl px-4 py-3 text-[8px] font-black uppercase tracking-widest text-hc-muted"
                >
                  Enable {modeLabel(mode)}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 2xl:grid-cols-[1.05fr_0.95fr] gap-6 mb-6">
        <section className="hc-clay-raised rounded-[2rem] p-6 border border-hc-border/20">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="section-header text-[10px] mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-hc-teal" />
                {careCircleEnabled ? 'Family-safe update builder' : 'Draft preview locked'}
              </div>
              <p className="text-xs text-hc-muted font-medium max-w-2xl leading-relaxed">
                {careCircleEnabled
                  ? 'Drafts a shareable update from client evidence. This does not publish externally; a manager reviews, edits, copies, and logs it.'
                  : 'The draft can be inspected, but copy and save are locked while Care Circle is off.'}
              </p>
            </div>
            <span className={`pill text-[9px] font-black uppercase tracking-widest ${!careCircleEnabled ? 'pill-blue' : shareability === 'green' ? 'pill-green' : shareability === 'amber' ? 'pill-amber' : 'pill-red'}`}>
              {careCircleEnabled ? `${shareability} shareability` : 'sharing off'}
            </span>
          </div>
          {!careCircleEnabled && (
            <div className="rounded-2xl border border-hc-amber/20 bg-hc-amber/10 p-4 mb-4 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-hc-amber mt-0.5 shrink-0" />
              <p className="text-xs font-bold text-hc-text leading-relaxed">
                No family member, professional, or external contact should receive this content yet. Turn on an approved mode, verify contacts, and review evidence first.
              </p>
            </div>
          )}
          <textarea
            value={reviewDraft}
            onChange={(event) => setReviewDraft(event.target.value)}
            disabled={!careCircleEnabled}
            rows={12}
            className={`w-full hc-clay-inset rounded-2xl p-5 text-sm text-hc-text font-medium leading-relaxed resize-y focus:outline-none ${careCircleEnabled ? '' : 'opacity-65 cursor-not-allowed'}`}
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
            ) : !entryStoreLoaded ? (
              <p className="text-[11px] text-hc-muted font-bold">Syncing diary source entries from the local evidence store...</p>
            ) : (
              <p className="text-[11px] text-hc-muted font-bold">No diary entries or reviewed document evidence are loaded for this person yet. Import source records before treating any update as share-ready.</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button
              onClick={() => copyUpdate()}
              disabled={!careCircleEnabled}
              className={`rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${careCircleEnabled ? 'btn-clay' : 'hc-clay-inset text-hc-muted/60 cursor-not-allowed'}`}
            >
              <Copy className="w-4 h-4" />
              {copiedId === 'draft' ? 'Copied' : careCircleEnabled ? 'Copy Internal Draft' : 'Copy Locked'}
            </button>
            <button
              onClick={saveGeneratedUpdate}
              disabled={!careCircleEnabled}
              className={`rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${careCircleEnabled ? 'btn-tactical' : 'hc-clay-inset text-hc-muted/60 cursor-not-allowed'}`}
            >
              <Save className="w-4 h-4" />
              {careCircleEnabled ? 'Save Reviewed Update' : 'Save Locked'}
            </button>
            <span className="text-[10px] font-bold text-hc-muted uppercase tracking-widest">
              {entryStoreLoaded ? entries.length : 'Syncing'} source entries scanned
            </span>
          </div>
        </section>

        <section className="hc-clay-raised rounded-[2rem] p-6 border border-hc-border/20">
          <div className="section-header text-[10px] mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-hc-teal" />
            Consent and boundaries
          </div>
          {!careCircleEnabled && (
            <div className="rounded-2xl border border-hc-border/20 bg-hc-border/10 p-4 mb-4">
              <div className="section-header text-[8px] mb-2">Required before activation</div>
              <p className="text-xs font-bold text-hc-muted leading-relaxed">
                Confirm consent, best-interest position where relevant, relationship permissions, safeguarding boundaries, and what must never be shared.
              </p>
            </div>
          )}
          <textarea
            value={circle.notes || ''}
            onChange={(event) => updateCircle({ notes: event.target.value })}
            rows={6}
            className="w-full hc-clay-inset rounded-2xl p-5 text-sm text-hc-text font-medium leading-relaxed resize-y focus:outline-none mb-4"
            placeholder="Consent, family dynamics, safeguarding restrictions, best-interest decisions, or professional access notes..."
          />
          <div className="grid grid-cols-3 gap-3">
            <div className="hc-clay-inset rounded-2xl p-4">
              <div className="text-xl font-black text-hc-text">{contacts.length}</div>
              <div className="section-header text-[9px]">Contacts added</div>
            </div>
            <div className="hc-clay-inset rounded-2xl p-4">
              <div className="text-xl font-black text-hc-text">{verifiedContacts.length}</div>
              <div className="section-header text-[9px]">Verified</div>
            </div>
            <div className="hc-clay-inset rounded-2xl p-4">
              <div className="text-xl font-black text-hc-text">{openItems.length}</div>
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
              {careCircleEnabled ? 'Permission-aware share pack' : 'Share pack locked'}
            </div>
            <p className="text-xs text-hc-muted font-medium max-w-3xl leading-relaxed">
              {careCircleEnabled
                ? 'Builds a controlled family or professional pack from the latest reviewed update. Internal evidence references stay inside OVSITE unless separately authorised.'
                : 'No family or professional pack can be released while Care Circle is off. Prepare the evidence, contacts, and boundaries, then activate a mode.'}
            </p>
          </div>
          <div className={`pill text-[9px] font-black uppercase tracking-widest ${!careCircleEnabled ? 'pill-blue' : shareReady ? 'pill-green' : 'pill-amber'}`}>
            {!careCircleEnabled ? 'Off' : shareReady ? 'Ready to share' : `${readinessIssues.length} checks`}
          </div>
        </div>
        {!careCircleEnabled && (
          <div className="rounded-2xl border border-hc-teal/20 bg-hc-teal/10 p-4 mt-5 flex items-start gap-3">
            <LockKeyhole className="w-4 h-4 text-hc-teal mt-0.5 shrink-0" />
            <p className="text-xs font-bold text-hc-text leading-relaxed">
              Release controls are intentionally disabled. This avoids the dangerous state where a contact list exists but consent, evidence, and sharing boundaries are not reviewed.
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mt-5">
          <div className="hc-clay-inset rounded-2xl p-4">
            <div className="section-header text-[8px] mb-2">Window</div>
            <div className="text-sm font-black text-hc-text capitalize">{circleInsight.windowLabel}</div>
          </div>
          <div className="hc-clay-inset rounded-2xl p-4">
            <div className="section-header text-[8px] mb-2">Release lane</div>
            <div className={`text-sm font-black uppercase ${circleInsight.releaseState === 'ready' ? 'text-hc-teal' : circleInsight.releaseState === 'blocked' ? 'text-flag-amber' : 'text-hc-muted'}`}>
              {circleInsight.releaseState.replace('_', ' ')}
            </div>
          </div>
          <div className="lg:col-span-2 hc-clay-inset rounded-2xl p-4">
            <div className="section-header text-[8px] mb-2">Next move</div>
            <div className="text-xs font-bold text-hc-text leading-relaxed">{circleInsight.nextMove}</div>
          </div>
          <div className="lg:col-span-2 rounded-2xl border border-hc-border/20 bg-hc-border/10 p-4">
            <div className="section-header text-[8px] mb-2">Family pressure</div>
            <div className="text-xs font-bold text-hc-muted leading-relaxed">{circleInsight.pressureLine}</div>
          </div>
          <div className="lg:col-span-2 rounded-2xl border border-hc-border/20 bg-hc-border/10 p-4">
            <div className="section-header text-[8px] mb-2">Guardrails</div>
            <ul className="space-y-1">
              {circleInsight.controls.map((control) => (
                <li key={control} className="text-[11px] font-bold text-hc-muted leading-relaxed">{control}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-5 mt-5">
          <div className="space-y-3">
            <select
              value={shareAudience}
              onChange={(event) => {
                setShareAudience(event.target.value as ShareAudience);
                setShareOverride(false);
              }}
              disabled={!careCircleEnabled}
              className={`w-full hc-clay-inset rounded-xl px-4 py-3 text-sm font-black text-hc-text focus:outline-none ${careCircleEnabled ? '' : 'opacity-65 cursor-not-allowed'}`}
              aria-label="Share pack audience"
            >
              {(Object.keys(PERMISSION_LABELS) as ShareAudience[]).map((level) => (
                <option key={level} value={level}>{permissionLabel(level)}</option>
              ))}
            </select>
            {shareOverrideAvailable && (
              <label className="hc-clay-inset rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-hc-muted flex items-start gap-3 leading-relaxed">
                <input
                  type="checkbox"
                  checked={shareOverride}
                  onChange={(event) => setShareOverride(event.target.checked)}
                  className="mt-0.5 accent-hc-teal"
                  aria-label="Manager override blocked share checks"
                />
                Manager override: release despite unresolved checks
              </label>
            )}
            <button
              onClick={copySharePack}
              disabled={!canReleaseSharePack}
              className={`w-full rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 ${canReleaseSharePack ? 'btn-clay' : 'hc-clay-inset text-hc-muted/60 cursor-not-allowed'}`}
            >
              <Copy className="w-4 h-4" />
              {copiedId === 'share-pack' ? 'Copied' : shareReady ? 'Copy Pack' : shareOverride ? 'Copy With Override' : 'Copy Locked'}
            </button>
            <button
              onClick={printSharePack}
              disabled={!canReleaseSharePack}
              className={`w-full rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 ${canReleaseSharePack ? 'btn-tactical' : 'hc-clay-inset text-hc-muted/60 cursor-not-allowed'}`}
            >
              <Printer className="w-4 h-4" />
              {shareReady ? 'Print Pack' : shareOverride ? 'Print With Override' : 'Print Locked'}
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
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="section-header text-[10px] flex items-center gap-2">
              <Users className="w-4 h-4 text-hc-teal" />
              Contacts and permissions
            </div>
            {!careCircleEnabled && <span className="pill pill-blue text-[8px] font-black uppercase tracking-widest">Setup only</span>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            <input value={contactDraft.name} onChange={(event) => setContactDraft({ ...contactDraft, name: event.target.value })} placeholder="Name" className="hc-clay-inset rounded-xl px-4 py-3 text-sm font-bold text-hc-text focus:outline-none" />
            <input value={contactDraft.relationship} onChange={(event) => setContactDraft({ ...contactDraft, relationship: event.target.value })} placeholder="Relationship" className="hc-clay-inset rounded-xl px-4 py-3 text-sm font-bold text-hc-text focus:outline-none" />
            <input value={contactDraft.email} onChange={(event) => setContactDraft({ ...contactDraft, email: event.target.value })} placeholder="Email" className="hc-clay-inset rounded-xl px-4 py-3 text-sm font-bold text-hc-text focus:outline-none" />
            <input value={contactDraft.phone} onChange={(event) => setContactDraft({ ...contactDraft, phone: event.target.value })} placeholder="Phone" className="hc-clay-inset rounded-xl px-4 py-3 text-sm font-bold text-hc-text focus:outline-none" />
            <select value={contactDraft.permissionLevel} onChange={(event) => setContactDraft({ ...contactDraft, permissionLevel: event.target.value as CareCirclePermissionLevel })} className="hc-clay-inset rounded-xl px-4 py-3 text-sm font-black text-hc-text focus:outline-none">
              {(Object.keys(PERMISSION_LABELS) as CareCirclePermissionLevel[]).map((level) => <option key={level} value={level}>{permissionLabel(level)}</option>)}
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
            {contacts.map((contact) => (
              <div key={contact.id} className="bg-hc-border/10 border border-hc-border/20 rounded-2xl p-4 flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-black text-hc-text">{contact.name}</div>
                  <div className="text-[10px] font-bold text-hc-muted uppercase tracking-widest mt-1">{contact.relationship} / {permissionLabel(contact.permissionLevel)}</div>
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
            {contacts.length === 0 && (
              <div className="rounded-2xl border border-dashed border-hc-border/40 bg-hc-border/10 p-5">
                <div className="section-header text-[9px] mb-2">No contacts reviewed yet</div>
                <p className="text-xs font-bold text-hc-muted leading-relaxed">
                  Add family, representatives, advocates, or professionals here as unverified contacts first. They only become releasable once consent, route, review date, and boundaries are checked.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="hc-clay-raised rounded-[2rem] p-6 border border-hc-border/20">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="section-header text-[10px] flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-hc-teal" />
              Concerns, compliments, and questions
            </div>
            {!careCircleEnabled && <span className="pill pill-blue text-[8px] font-black uppercase tracking-widest">Internal log</span>}
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
            {(circle.concerns || []).map((concern) => {
              const responseStatus = getCareCircleResponseStatus(concern);
              return (
                <div key={concern.id} className="bg-hc-border/10 border border-hc-border/20 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-black text-hc-text uppercase">{concernTypeLabel(concern.type)}</div>
                      <div className="text-[10px] font-bold text-hc-muted uppercase tracking-widest mt-1">{concern.priority} / {concern.source || 'No source'} / due {concern.dueDate || 'unset'}</div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <span className={`pill text-[8px] font-black uppercase tracking-widest ${responseStatus.tone === 'green' ? 'pill-green' : responseStatus.tone === 'amber' ? 'pill-amber' : 'pill-purple'}`}>
                        {responseStatus.label}
                      </span>
                      <select
                        value={concern.status}
                        onChange={(event) => {
                          const nextStatus = event.target.value as CareCircleConcern['status'];
                          if (nextStatus === 'resolved') resolveConcernWithResponse(concern);
                          else updateConcern(concern.id, { status: nextStatus });
                        }}
                        className="hc-clay-inset rounded-xl px-3 py-2 text-[10px] font-black text-hc-text focus:outline-none"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In progress</option>
                        <option value="resolved" disabled={!responseStatus.canResolve}>Resolved</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-xs text-hc-text/80 leading-relaxed mt-3">{concern.detail}</p>
                  {concern.actionId && (
                    <div className="mt-3 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-hc-teal">
                      <Link2 className="w-3 h-3" />
                      Action linked
                    </div>
                  )}
                  <textarea value={concern.response} onChange={(event) => updateConcern(concern.id, { response: event.target.value })} placeholder="Response/actions taken..." rows={2} className="mt-3 w-full hc-clay-inset rounded-xl px-4 py-3 text-xs font-bold text-hc-text focus:outline-none" />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => copyConcernResponse(concern)}
                      disabled={!responseStatus.canCopy}
                      className={`rounded-xl px-4 py-2 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${responseStatus.canCopy ? 'btn-clay' : 'hc-clay-inset text-hc-muted/60 cursor-not-allowed'}`}
                    >
                      <Copy className="w-3 h-3" />
                      {copiedId === `response-${concern.id}` ? 'Copied' : 'Copy Response'}
                    </button>
                    <button
                      onClick={() => resolveConcernWithResponse(concern)}
                      disabled={!responseStatus.canResolve || concern.status === 'resolved'}
                      className={`rounded-xl px-4 py-2 text-[9px] font-black uppercase tracking-widest ${responseStatus.canResolve && concern.status !== 'resolved' ? 'btn-tactical' : 'hc-clay-inset text-hc-muted/60 cursor-not-allowed'}`}
                    >
                      Mark Resolved
                    </button>
                  </div>
                </div>
              );
            })}
            {(circle.concerns || []).length === 0 && (
              <div className="rounded-2xl border border-dashed border-hc-border/40 bg-hc-border/10 p-5">
                <div className="section-header text-[9px] mb-2">No family/professional items logged</div>
                <p className="text-xs font-bold text-hc-muted leading-relaxed">
                  Use this as the internal trace for questions, concerns, compliments, and actions before any Care Circle visibility is enabled.
                </p>
              </div>
            )}
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
