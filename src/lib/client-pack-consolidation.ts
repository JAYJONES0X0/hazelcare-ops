interface PackManifestClientMatch {
  clientId: string | null;
  name: string | null;
  confidence: number;
  matchReason: string;
}

interface PackManifestRowLike {
  fileId?: string;
  originalFileName: string;
  parseStatus: string;
  reviewRequired: boolean;
  clientMatch: PackManifestClientMatch;
}

interface PackImportLike {
  packId: string;
  uploadedAt?: string;
  uploadedBy?: string;
  sourceName: string;
  sourceType?: 'zip' | 'pdf' | 'multi-file' | 'single-file' | string;
  candidateClientId: string | null;
  candidateClientName: string | null;
  identityConfidence: number;
  manifestRows?: PackManifestRowLike[];
  auditEventIds?: string[];
}

interface VaultDocLike {
  fileId?: string;
  name: string;
  packId?: string;
}

interface PackClientLike {
  id: string;
  name: string;
  dob?: string;
  nhs?: string;
  address?: string;
  phone?: string;
  packImports?: PackImportLike[];
  vaultDocs?: VaultDocLike[];
  carePlan?: { domains?: Array<{ enabled?: boolean; identifiedNeed?: string }> } | null;
  supportPlan?: { needs?: unknown[] } | null;
  risk?: { risks?: Array<{ title?: string; description?: string }> } | null;
  careCircle?: {
    contacts?: unknown[];
    updates?: unknown[];
    concerns?: unknown[];
  } | null;
}

const NON_PERSON_IDENTITY_TERMS = new Set([
  'admission',
  'assessment',
  'behaviour',
  'behavioural',
  'benefits',
  'care',
  'client',
  'contact',
  'details',
  'emergency',
  'finance',
  'financial',
  'health',
  'legal',
  'medication',
  'mental',
  'pack',
  'pbs',
  'plan',
  'positive',
  'profile',
  'report',
  'risk',
  'support',
  'tenancy',
  'welcome',
]);

function cleanText(value: string | undefined | null) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function normalizedName(value: string | undefined | null) {
  return cleanText(value)
    .replace(/^(mr|mrs|ms|miss|mx|dr)\.?\s+/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9'-]+/g, ' ')
    .trim();
}

function isPlausiblePersonName(value: string | undefined | null) {
  const normalized = normalizedName(value);
  if (!normalized) return false;
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  if (words.some(word => NON_PERSON_IDENTITY_TERMS.has(word))) return false;
  if (words.some(word => word.length < 2)) return false;
  return true;
}

function identityQuality(client: PackClientLike, packId: string) {
  const packConfidence = Math.max(
    0,
    ...(client.packImports || [])
      .filter(pack => pack.packId === packId)
      .map(pack => pack.identityConfidence || 0),
  );
  let score = packConfidence * 20;
  if (isPlausiblePersonName(client.name)) score += 25;
  else score -= 50;
  if (client.dob) score += 35;
  if (client.nhs) score += 55;
  if (client.address) score += 15;
  if (client.phone) score += 10;
  if (client.carePlan?.domains?.some(domain => domain.enabled || domain.identifiedNeed)) score += 15;
  if (client.supportPlan?.needs?.length) score += 15;
  return score;
}

function buildConsolidatedPackImport(input: {
  packId: string;
  sourceName: string;
  rows: PackManifestRowLike[];
  candidateClientId: string;
  candidateClientName: string;
  identityConfidence: number;
  uploadedBy?: string;
  auditEventIds?: string[];
  sourceType?: PackImportLike['sourceType'];
}): PackImportLike {
  const filesParsed = input.rows.filter(row => row.parseStatus === 'PARSED').length;
  const filesFailed = input.rows.filter(row => row.parseStatus === 'FAILED' || row.parseStatus === 'SKIPPED_WITH_REASON').length;
  const filesNeedsReview = input.rows.filter(row => row.reviewRequired).length;
  const filesAttached = input.rows.filter(row => !['PARSED', 'FAILED', 'SKIPPED_WITH_REASON'].includes(row.parseStatus)).length;
  return {
    packId: input.packId,
    uploadedAt: new Date().toISOString(),
    uploadedBy: input.uploadedBy || 'local-session',
    sourceName: input.sourceName,
    sourceType: input.sourceType || (input.sourceName.toLowerCase().endsWith('.zip') ? 'zip' : 'single-file'),
    status: filesFailed === input.rows.length && input.rows.length > 0 ? 'FAILED' : 'DRAFT_CLIENT',
    candidateClientId: input.candidateClientId,
    candidateClientName: input.candidateClientName,
    identityConfidence: input.identityConfidence,
    filesTotal: input.rows.length,
    filesParsed,
    filesAttached,
    filesFailed,
    filesNeedsReview,
    manifestRows: input.rows,
    auditEventIds: input.auditEventIds || [],
  } as PackImportLike;
}

function mergePackImportsForOwner(owner: PackClientLike, packId: string, duplicatePacks: PackImportLike[]) {
  const rows = new Map<string, PackManifestRowLike>();
  const audits = new Set<string>();
  for (const pack of duplicatePacks) {
    for (const row of pack.manifestRows || []) {
      rows.set(row.fileId || row.originalFileName.toLowerCase(), {
        ...row,
        clientMatch: {
          ...row.clientMatch,
          clientId: owner.id,
          name: owner.name,
          confidence: Math.max(row.clientMatch.confidence || 0, owner.dob || owner.nhs ? 0.95 : 0.78),
          matchReason: 'Pack ownership consolidated to the evidence-backed client identity.',
        },
      });
    }
    for (const auditId of pack.auditEventIds || []) audits.add(auditId);
  }
  const source = duplicatePacks.sort((a, b) => b.identityConfidence - a.identityConfidence)[0];
  return buildConsolidatedPackImport({
    packId,
    sourceName: source?.sourceName || 'Client Pack',
    sourceType: source?.sourceType,
    rows: [...rows.values()],
    candidateClientId: owner.id,
    candidateClientName: owner.name,
    identityConfidence: Math.max(source?.identityConfidence || 0, owner.dob || owner.nhs ? 0.95 : 0.78),
    uploadedBy: source?.uploadedBy,
    auditEventIds: [...audits],
  });
}

function mergeVaultEvidence(owner: PackClientLike, clients: PackClientLike[]) {
  const docs = new Map<string, VaultDocLike>();
  for (const client of clients) {
    for (const doc of client.vaultDocs || []) {
      docs.set(doc.fileId || doc.name.toLowerCase(), doc);
    }
  }
  owner.vaultDocs = [...docs.values()];
}

function isDisposablePackArtifact(client: PackClientLike) {
  if (isPlausiblePersonName(client.name) || client.dob || client.nhs || client.address || client.phone) return false;
  if (client.carePlan?.domains?.some(domain => domain.enabled || domain.identifiedNeed)) return false;
  if (client.supportPlan?.needs?.length || client.risk?.risks?.some(risk => risk.title || risk.description)) return false;
  if (client.careCircle?.contacts?.length || client.careCircle?.updates?.length || client.careCircle?.concerns?.length) return false;
  return true;
}

export function consolidateDuplicatePackClients<T extends PackClientLike>(inputClients: T[]): {
  clients: T[];
  changed: boolean;
  removedClientNames: string[];
} {
  let clients = inputClients.map(client => ({
    ...client,
    packImports: [...(client.packImports || [])],
    vaultDocs: [...(client.vaultDocs || [])],
  })) as T[];
  const removedClientNames: string[] = [];
  let changed = false;

  const packIds = new Set(clients.flatMap(client => (client.packImports || []).map(pack => pack.packId)));
  for (const packId of packIds) {
    const owners = clients.filter(client => (client.packImports || []).some(pack => pack.packId === packId));
    if (owners.length < 2) continue;

    const ranked = [...owners].sort((a, b) => identityQuality(b, packId) - identityQuality(a, packId));
    const owner = ranked[0];
    const losers = ranked.slice(1);
    const duplicatePacks = owners.flatMap(client => (client.packImports || []).filter(pack => pack.packId === packId));

    mergeVaultEvidence(owner, owners);
    owner.packImports = [
      mergePackImportsForOwner(owner, packId, duplicatePacks),
      ...(owner.packImports || []).filter(pack => pack.packId !== packId),
    ] as T['packImports'];

    const loserIdsToRemove = new Set<string>();
    for (const loser of losers) {
      loser.packImports = (loser.packImports || []).filter(pack => pack.packId !== packId) as T['packImports'];
      loser.vaultDocs = (loser.vaultDocs || []).filter(doc => doc.packId !== packId) as T['vaultDocs'];
      if (!loser.packImports?.length && !loser.vaultDocs?.length && isDisposablePackArtifact(loser)) {
        loserIdsToRemove.add(loser.id);
        removedClientNames.push(loser.name);
      }
    }
    clients = clients.filter(client => !loserIdsToRemove.has(client.id));
    changed = true;
  }

  return { clients, changed, removedClientNames };
}
