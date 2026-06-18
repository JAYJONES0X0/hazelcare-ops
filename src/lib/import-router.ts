import type { FullClient, PackFileManifestRow, PackImport, VaultDoc } from './client-store';
import { emptyCareCircle, emptyClient, loadClients, resolveClientMatch, saveClient, type CareCircleContact } from './client-store';
import { mergeClientIdentity } from './client-identity-merge';
import { mergeCarePlanData, mergeRiskData, mergeSupportPlanData } from './intel-merge';
import type { ImportTarget, NormalizedImportEnvelope } from './import-intelligence';
import type { StaffMember, TemplateType } from './types';
import { exportOpsSnapshot, importOpsSnapshot, loadWeekData, mergeWeekSummaries, saveWeekData, loadShifts, saveShifts } from './storage';
import type { Page } from './types';
import { logAuditAction } from './audit';
import { buildPackFileManifestRow, buildPackImport, clientLiveGateSummary } from './client-pack';

const TEMPLATE_CONTEXT_KEY = 'hc-template-import-context';

export type ClientMode = 'specific' | 'auto' | 'global';

export interface RouteImportOptions {
  targets: ImportTarget[];
  clientMode: ClientMode;
  selectedClientId?: string | null;
  selectedTemplateIds?: TemplateType[];
  packId?: string;
  packSourceName?: string;
  packRow?: PackFileManifestRow;
  packRows?: PackFileManifestRow[];
}

export interface RouteImportResult {
  ok: boolean;
  page: Page;
  messages: string[];
  warnings: string[];
  requiresManualClientSelection?: boolean;
}

function pickClient(envelope: NormalizedImportEnvelope, opts: RouteImportOptions): { client: FullClient; existed: boolean; requiresManualSelection: boolean } {
  if (opts.clientMode === 'specific' && opts.selectedClientId) {
    const selected = loadClients().find(c => c.id === opts.selectedClientId);
    if (selected) return { client: { ...selected }, existed: true, requiresManualSelection: false };
  }

  const candidate = envelope.clientCandidates[0] || {};
  const resolution = resolveClientMatch({
    name: candidate.name,
    nhs: candidate.nhs,
    dob: candidate.dob,
  });

  if (resolution.best) {
    // In global mode we still try to prevent duplicates:
    // - always trust deterministic matches (NHS / name+DOB)
    // - trust strong fuzzy matches only (>=0.9)
    const canAutoUseGlobal =
      opts.clientMode === 'global' &&
      (resolution.best.strategy === 'nhs' || resolution.best.strategy === 'name_dob' || resolution.best.score >= 0.9);

    if (opts.clientMode !== 'global' || canAutoUseGlobal) {
      return {
        client: { ...resolution.best.client },
        existed: true,
        requiresManualSelection: opts.clientMode === 'global' ? false : resolution.requiresManualSelection,
      };
    }
  }

  return { client: emptyClient(), existed: false, requiresManualSelection: opts.clientMode !== 'global' };
}

function contactKey(contact: CareCircleContact) {
  return [
    contact.name.trim().toLowerCase(),
    contact.relationship.trim().toLowerCase(),
    contact.email.trim().toLowerCase(),
    contact.phone.replace(/\s+/g, ''),
  ].join('|');
}

function mergeCareCircleContacts(existing: CareCircleContact[], incoming: CareCircleContact[]) {
  const merged = [...existing];
  const seen = new Set(merged.map(contactKey));
  let added = 0;

  for (const contact of incoming) {
    const normalizedContact: CareCircleContact = {
      ...contact,
      verified: false,
      consentBasis: contact.consentBasis || 'Imported from document. Consent not reviewed.',
      restrictions: contact.restrictions || 'Sharing boundary requires manager review.',
      consentStatus: 'unverified',
      sharingBoundary: 'review_required',
      managerReviewed: false,
      confidence: contact.confidence ?? 0.72,
    };
    const key = contactKey(normalizedContact);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(normalizedContact);
    added++;
  }

  return { contacts: merged, added };
}

function routeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function compactDocText(envelope: NormalizedImportEnvelope, row: PackFileManifestRow) {
  const text = (envelope.rawText || '').trim();
  if (text) return text.slice(0, 12000);
  if (row.category === 'profile_image') return `[Profile image attached for review: ${row.originalFileName}]`;
  return `[No extractable text available. ${row.parseStatus}. ${row.rejectedReasons.join(' ')}]`.trim();
}

function upsertVaultDoc(client: FullClient, envelope: NormalizedImportEnvelope, row: PackFileManifestRow): { added: boolean; doc: VaultDoc } {
  const docs = [...(client.vaultDocs || [])];
  const existingIdx = docs.findIndex(doc => doc.name.toLowerCase() === row.originalFileName.toLowerCase());
  const doc: VaultDoc = {
    ...(existingIdx >= 0 ? docs[existingIdx] : {}),
    id: existingIdx >= 0 ? docs[existingIdx].id : `vault-${row.fileId}`,
    name: row.originalFileName,
    text: compactDocText(envelope, row),
    uploadedAt: existingIdx >= 0 ? docs[existingIdx].uploadedAt : new Date().toISOString(),
    packId: row.packId,
    fileId: row.fileId,
    category: row.category,
    parseStatus: row.parseStatus,
    classificationConfidence: row.classificationConfidence,
    reviewRequired: row.reviewRequired,
    sourceFileName: row.originalFileName,
    targetScreen: row.targetScreen,
    rejectedReasons: row.rejectedReasons,
  };
  if (existingIdx >= 0) docs[existingIdx] = doc;
  else docs.push(doc);
  client.vaultDocs = docs;
  return { added: existingIdx < 0, doc };
}

function packFromRows(
  opts: RouteImportOptions,
  row: PackFileManifestRow,
  client: FullClient,
  auditEventIds: string[],
): PackImport {
  const rows = opts.packRows?.length ? opts.packRows : [row];
  const candidateName = client.name || row.clientMatch.name || null;
  return buildPackImport({
    packId: row.packId,
    sourceName: opts.packSourceName || row.originalFileName,
    rows,
    candidateClientId: client.id || null,
    candidateClientName: candidateName,
    identityConfidence: row.clientMatch.confidence || (candidateName ? 0.7 : 0),
    auditEventIds,
  });
}

function upsertPackImport(client: FullClient, incoming: PackImport) {
  const packs = [...(client.packImports || [])];
  const existingIdx = packs.findIndex(pack => pack.packId === incoming.packId);
  if (existingIdx < 0) {
    client.packImports = [incoming, ...packs];
    return;
  }
  const existing = packs[existingIdx];
  const rowMap = new Map<string, PackFileManifestRow>();
  [...existing.manifestRows, ...incoming.manifestRows].forEach(row => {
    rowMap.set(row.fileId || row.originalFileName, row);
  });
  const mergedRows = [...rowMap.values()];
  packs[existingIdx] = buildPackImport({
    packId: incoming.packId,
    sourceName: incoming.sourceName || existing.sourceName,
    rows: mergedRows,
    candidateClientId: incoming.candidateClientId || existing.candidateClientId,
    candidateClientName: incoming.candidateClientName || existing.candidateClientName,
    identityConfidence: Math.max(existing.identityConfidence || 0, incoming.identityConfidence || 0),
    auditEventIds: Array.from(new Set([...(existing.auditEventIds || []), ...(incoming.auditEventIds || [])])),
    sourceType: incoming.sourceType || existing.sourceType,
  });
  client.packImports = packs;
}

function applyDraftOnboardingState(client: FullClient) {
  const unresolvedFiles = (client.vaultDocs || []).filter(doc => doc.reviewRequired).length;
  const hasCarePlanSource =
    !!client.carePlan?.domains?.some(domain => domain.enabled || domain.identifiedNeed) ||
    !!client.supportPlan?.needs?.length ||
    !!client.vaultDocs?.some(doc => ['care_plan', 'support_plan', 'admission'].includes(doc.category || ''));
  const hasRiskSource =
    !!client.risk?.risks?.some(risk => risk.title || risk.description) ||
    !!client.vaultDocs?.some(doc => ['risk', 'pbs'].includes(doc.category || ''));
  const contacts = client.careCircle?.contacts || [];
  const contactsReviewed = contacts.length > 0 && contacts.every(contact => contact.verified && contact.managerReviewed);
  const consentBoundariesReviewed = contacts.length > 0 && contacts.every(contact =>
    contact.consentStatus === 'reviewed' &&
    contact.sharingBoundary &&
    contact.sharingBoundary !== 'review_required'
  );
  const hasMedicationSource = !!client.vaultDocs?.some(doc => doc.category === 'medication');
  const hasPbsSource = !!client.vaultDocs?.some(doc => doc.category === 'pbs') || !!client.pbs;
  const hasFinanceLegal = !!client.vaultDocs?.some(doc => ['finance', 'tenancy', 'mental_health_legal'].includes(doc.category || ''));
  const unknownReviewOpen = !!client.vaultDocs?.some(doc =>
    ['unknown', 'transcript', 'screenshot', 'irrelevant'].includes(doc.category || '') && doc.reviewRequired
  );
  const summary = clientLiveGateSummary({
    identityReviewed: client.onboardingStatus === 'REVIEWED_CLIENT' || client.onboardingStatus === 'LIVE_CLIENT',
    hasCarePlanSource,
    riskReviewed: (client.onboardingStatus === 'REVIEWED_CLIENT' || client.onboardingStatus === 'LIVE_CLIENT') && hasRiskSource,
    contactsReviewed: (client.onboardingStatus === 'REVIEWED_CLIENT' || client.onboardingStatus === 'LIVE_CLIENT') && contactsReviewed,
    consentBoundariesReviewed: (client.onboardingStatus === 'REVIEWED_CLIENT' || client.onboardingStatus === 'LIVE_CLIENT') && consentBoundariesReviewed,
    hasRiskSource,
    hasPbsSource,
    hasMedicationSource,
    financeLegalReviewed: (client.onboardingStatus === 'REVIEWED_CLIENT' || client.onboardingStatus === 'LIVE_CLIENT') && hasFinanceLegal,
    unknownDocumentsReviewedOrDeferred: !unknownReviewOpen,
    unresolvedFiles,
  });
  client.liveGateSummary = summary;
  client.onboardingGates = summary.gates;
  if (client.onboardingStatus !== 'REVIEWED_CLIENT' && client.onboardingStatus !== 'LIVE_CLIENT') {
    client.onboardingStatus = 'DRAFT_CLIENT';
  }
}

export function routeImport(envelope: NormalizedImportEnvelope, opts: RouteImportOptions): RouteImportResult {
  const messages: string[] = [];
  const warnings: string[] = [...envelope.warnings];
  const previousWeekData = loadWeekData();
  const snapshot = exportOpsSnapshot();

  try {
    const selectedClient = opts.selectedClientId ? loadClients().find(c => c.id === opts.selectedClientId) : null;
    if (opts.clientMode === 'specific' && !opts.selectedClientId) {
      return { ok: false, page: 'upload', messages: [], warnings: ['Specific client mode requires selecting a client.'] };
    }
    if (opts.clientMode === 'specific' && opts.selectedClientId && !selectedClient) {
      return { ok: false, page: 'upload', messages: [], warnings: ['Selected client no longer exists. Choose a valid client and retry.'] };
    }

    const needsClientWrite =
      (opts.targets.includes('client-docs') || opts.targets.includes('templates')) &&
      !!(envelope.admission || envelope.supportPlan || envelope.contactDetails || envelope.source.fileName);
    let preValidatedPick: { client: FullClient; existed: boolean; requiresManualSelection: boolean } | null = null;
    if (needsClientWrite) {
      preValidatedPick = pickClient(envelope, opts);
      if (opts.clientMode === 'auto' && preValidatedPick.requiresManualSelection) {
        return {
          ok: false,
          page: 'upload',
          messages: [],
          warnings: ['Client match confidence is low. Select a specific client before importing.'],
          requiresManualClientSelection: true,
        };
      }
    }

    if (opts.targets.includes('reports') || opts.targets.includes('templates')) {
      if (envelope.weekSummary) {
        const currentWeekData = loadWeekData();
        const mergedWeekData = mergeWeekSummaries(currentWeekData, envelope.weekSummary);
        saveWeekData(mergedWeekData);
        messages.push(`Loaded ${envelope.weekSummary.totalEntries} diary entries (${mergedWeekData.totalEntries} total in reporting state).`);
      } else if (opts.targets.includes('reports')) {
        warnings.push('Reports target selected but no diary summary data was parsed.');
      }
    }

    let requiresManualClientSelection = false;
    if (opts.targets.includes('client-docs') || opts.targets.includes('templates')) {
      if (envelope.admission || envelope.supportPlan || envelope.contactDetails || opts.targets.includes('client-docs')) {
        const picked = preValidatedPick || pickClient(envelope, opts);
        const client = picked.client;
        const today = new Date().toLocaleDateString('en-GB');
        requiresManualClientSelection = picked.requiresManualSelection;
        const packId = opts.packId || routeId('pack');

        const candidateName =
          envelope.clientCandidates[0]?.name ||
          envelope.admission?.client?.name ||
          envelope.contactDetails?.clientName ||
          '';
        if (candidateName && !client.name) {
          client.name = candidateName;
          client.preferredName = envelope.clientCandidates[0]?.preferredName || candidateName.split(/\s+/)[0] || '';
        } else if (!client.name && opts.targets.includes('client-docs')) {
          const draftName = envelope.source.fileName
            .replace(/\.[^.]+$/, '')
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          client.name = draftName ? `Draft: ${draftName}` : 'Draft Client From Pack';
          client.preferredName = client.name.split(/\s+/)[0] || 'Draft';
        }

        const row = opts.packRow || buildPackFileManifestRow({
          packId,
          envelope,
          fileName: envelope.source.fileName,
          clientId: client.id,
          clientName: client.name || envelope.clientCandidates[0]?.name || null,
          clientConfidence: picked.existed ? 0.9 : (envelope.clientCandidates[0]?.name ? 0.72 : 0),
          matchReason: picked.existed ? 'Matched existing client record.' : 'Draft client identity inferred from imported source.',
          sizeBytes: envelope.source.sizeBytes,
        });
        const auditEventIds: string[] = [];
        const packAudit = logAuditAction('pack_uploaded', `Client pack evidence received: ${opts.packSourceName || row.originalFileName}`, {
          packId: row.packId,
          fileName: row.originalFileName,
          category: row.category,
          parseStatus: row.parseStatus,
        }, [{ sourceType: 'pdf_import', sourceId: row.originalFileName, timestamp: new Date().toISOString() }]);
        auditEventIds.push(packAudit.id);
        const classifyAudit = logAuditAction('file_classified', `Classified ${row.originalFileName} as ${row.category}`, {
          packId: row.packId,
          fileId: row.fileId,
          confidence: row.classificationConfidence,
          parseStatus: row.parseStatus,
          reviewRequired: row.reviewRequired,
          rejectedReasons: row.rejectedReasons,
        });
        auditEventIds.push(classifyAudit.id);
        const parseStartedAudit = logAuditAction('file_parse_started', `${row.originalFileName} parse started`, {
          packId: row.packId,
          fileId: row.fileId,
          category: row.category,
        });
        auditEventIds.push(parseStartedAudit.id);
        const parseAudit = logAuditAction(
          row.parseStatus === 'FAILED' || row.parseStatus === 'SKIPPED_WITH_REASON' ? 'file_parse_failed' : 'file_parse_completed',
          `${row.originalFileName} parse status: ${row.parseStatus}`,
          {
            packId: row.packId,
            fileId: row.fileId,
            category: row.category,
            parseStatus: row.parseStatus,
            extractedFieldsCount: row.extractedFieldsCount,
            reviewRequired: row.reviewRequired,
            rejectedReasons: row.rejectedReasons,
          }
        );
        auditEventIds.push(parseAudit.id);

        if (envelope.admission) {
          const mergedIdentity = mergeClientIdentity(client as FullClient, envelope.admission.client);
          Object.assign(client, mergedIdentity);
          
          // ADDITIVE MERGE for Care Plan and Risk
          client.carePlan = mergeCarePlanData(client.carePlan || null, envelope.admission.carePlan, today);
          if (envelope.admission.client.risk) {
            client.risk = mergeRiskData(client.risk || null, envelope.admission.client.risk, today);
          }
          
          messages.push(`${client.name || 'Client'} ${picked.existed ? 'merged' : 'created'} from admission/risk/care-plan data.`);
        }

        if (envelope.supportPlan) {
          const previousCount = client.supportPlan?.needs?.length || 0;
          client.supportPlan = mergeSupportPlanData(client.supportPlan || null, envelope.supportPlan);
          const mergedCount = client.supportPlan?.needs?.length || 0;
          const delta = Math.max(0, mergedCount - previousCount);
          messages.push(`${client.name || 'Client'} support plan merged (${mergedCount} areas, +${delta} new).`);
        }

        if (envelope.contactDetails) {
          if (envelope.contactDetails.clientName && !client.name) {
            client.name = envelope.contactDetails.clientName;
            client.preferredName = envelope.contactDetails.clientName.split(/\s+/)[0] || '';
          }
          if (envelope.contactDetails.clientAddress && !client.address) {
            client.address = envelope.contactDetails.clientAddress;
          }

          const reviewDate = client.reviewDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB');
          const circle = client.careCircle || emptyCareCircle(reviewDate);
          const sourceContacts = envelope.contactDetails.contacts.map(contact => ({
            ...contact,
            sourceDocument: contact.sourceDocument || row.originalFileName,
            sourceFileId: contact.sourceFileId || row.fileId,
            confidence: contact.confidence ?? row.classificationConfidence,
          }));
          const merged = mergeCareCircleContacts(circle.contacts || [], sourceContacts);
          client.careCircle = {
            ...circle,
            mode: circle.mode,
            contacts: merged.contacts,
            notes: circle.notes || 'Imported contacts require consent, relationship, and sharing-boundary verification before external communication.',
          };
          messages.push(`${client.name || 'Client'} contacts merged into Care Circle (${merged.contacts.length} total, +${merged.added} new).`);
          const contactAudit = logAuditAction('contact_imported_unverified', `${client.name || 'Client'} contacts imported as unverified Care Circle entries`, {
            packId: row.packId,
            contactsAdded: merged.added,
            totalContacts: merged.contacts.length,
          });
          auditEventIds.push(contactAudit.id);
        }

        if (opts.targets.includes('client-docs')) {
          const vault = upsertVaultDoc(client as FullClient, envelope, row);
          const attachAudit = logAuditAction(row.category === 'profile_image' ? 'profile_image_attached' : 'document_attached_to_vault', `${row.originalFileName} attached to ${client.name || 'client'} evidence vault`, {
            packId: row.packId,
            fileId: row.fileId,
            category: row.category,
            parseStatus: row.parseStatus,
            reviewRequired: row.reviewRequired,
            added: vault.added,
          });
          auditEventIds.push(attachAudit.id);
          if (row.parseStatus === 'OCR_REQUIRED') {
            const ocrAudit = logAuditAction('ocr_required', `${row.originalFileName} needs OCR or manual review`, {
              packId: row.packId,
              fileId: row.fileId,
              category: row.category,
            });
            auditEventIds.push(ocrAudit.id);
          }
          messages.push(`${row.originalFileName} attached to ${client.name || 'draft client'} evidence vault (${row.parseStatus}${row.reviewRequired ? ', review required' : ''}).`);
        }

        const pack = packFromRows(opts, row, client as FullClient, auditEventIds);
        upsertPackImport(client as FullClient, pack);
        applyDraftOnboardingState(client as FullClient);
        if (!picked.existed) {
          const draftAudit = logAuditAction('client_draft_created', `Draft client created from imported pack: ${client.name || 'unnamed client'}`, {
            packId: row.packId,
            clientId: client.id,
            clientName: client.name,
          });
          const updatedPack = packFromRows(opts, row, client as FullClient, [...auditEventIds, draftAudit.id]);
          upsertPackImport(client as FullClient, updatedPack);
        }
        saveClient(client as FullClient);
      }
    }

    if (opts.targets.includes('templates')) {
      let prev: Record<string, unknown> = {};
      try {
        const raw = localStorage.getItem(TEMPLATE_CONTEXT_KEY);
        if (raw) prev = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        /* ignore */
      }
      const selectedTemplateIds =
        opts.selectedTemplateIds !== undefined
          ? opts.selectedTemplateIds
          : ((prev.selectedTemplateIds as TemplateType[] | undefined) ?? []);
      const context = {
        ...prev,
        at: new Date().toISOString(),
        parserProfile: envelope.source.parserProfile,
        detectedType: envelope.source.detectedType,
        hasWeekSummary: !!envelope.weekSummary,
        hasAdmission: !!envelope.admission,
        hasSupportPlan: !!envelope.supportPlan,
        selectedTemplateIds,
      };
      localStorage.setItem(TEMPLATE_CONTEXT_KEY, JSON.stringify(context));
      messages.push(
        (opts.selectedTemplateIds?.length || 0) > 0
          ? `Template context prepared (${opts.selectedTemplateIds!.length} selected).`
          : 'Template context prepared from imported source data.'
      );
    }

    const page: Page = opts.targets.includes('templates') && !!envelope.weekSummary
      ? 'templates'
      : opts.targets.includes('client-docs')
      ? 'client-docs'
      : opts.targets.includes('roster')
      ? 'dashboard'
      : 'reports';

    if (opts.targets.includes('roster') && envelope.shifts.length > 0) {
      const existingShifts = loadShifts();
      const staff = (() => {
        try {
          return JSON.parse(localStorage.getItem('hazelcare-staff') || '[]') as Partial<StaffMember>[];
        } catch { return []; }
      })();

      const resolvedShifts = envelope.shifts.map(s => {
        const staffName = s.staffId || '';
        const found = staff.find((sm) => {
          const candidateName = sm.name || '';
          if (!staffName || !candidateName) return false;
          return candidateName.toLowerCase().includes(staffName.toLowerCase()) || staffName.toLowerCase().includes(candidateName.toLowerCase());
        });
        return {
          ...s,
          staffId: found ? found.id : s.staffId // fallback to name if not found
        };
      });

      // Filter out duplicate shifts (same staff, same date, same type)
      const merged = [...existingShifts];
      let added = 0;
      for (const rs of resolvedShifts) {
        const isDuplicate = merged.some(es => es.staffId === rs.staffId && es.date === rs.date && es.type === rs.type);
        if (!isDuplicate) {
          merged.push(rs);
          added++;
        }
      }
      saveShifts(merged);
      messages.push(`Imported ${added} new shifts to the Live Roster.`);
    }

    return { ok: true, page, messages, warnings, requiresManualClientSelection };
  } catch (err) {
    const rollback = importOpsSnapshot(snapshot);
    saveWeekData(previousWeekData);
    const msg = err instanceof Error ? err.message : 'Unknown import error';
    const rollbackMsg = rollback.ok ? '' : ` Rollback failed: ${rollback.error}`;
    return { ok: false, page: 'upload', messages: [], warnings: [`Import rolled back: ${msg}.${rollbackMsg}`.trim()] };
  }
}
