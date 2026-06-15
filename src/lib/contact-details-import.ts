import type { CareCircleContact } from './client-store';

type ContactDetailsImport = {
  clientName?: string;
  clientAddress?: string;
  contacts: CareCircleContact[];
};

const CONTACT_HEADING_PATTERN = /^(GP|Father|Mother|Support Planning and Brokerage Service|Social Worker|Next of Kin|Emergency Contact|Family|Advocate)$/i;

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function normalizeLines(rawText: string) {
  return rawText
    .replace(/\t/g, ' ')
    .split(/\r?\n/)
    .map(cleanText)
    .filter(Boolean);
}

function todayPlusMonths(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toLocaleDateString('en-GB');
}

function permissionForRelationship(relationship: string): CareCircleContact['permissionLevel'] {
  return /gp|surgery|brokerage|social worker|professional|advocate|team|service/i.test(relationship)
    ? 'professional'
    : 'reassurance';
}

function safeId(seed: string) {
  return `contact-${cleanText(seed).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || Date.now()}`;
}

function appendField(fields: Record<string, string>, key: string, value: string) {
  const cleaned = cleanText(value);
  if (!cleaned) return;
  fields[key] = fields[key] ? `${fields[key]} ${cleaned}` : cleaned;
}

function linesToBlocks(lines: string[]) {
  const blocks: Array<{ relationship: string; lines: string[] }> = [];
  let current: { relationship: string; lines: string[] } | null = null;

  for (const line of lines) {
    if (/^contact details$/i.test(line) || /^client contact type details$/i.test(line)) continue;
    const heading = line.match(CONTACT_HEADING_PATTERN)?.[1];
    if (heading) {
      current = { relationship: heading, lines: [] };
      blocks.push(current);
      continue;
    }
    current?.lines.push(line);
  }

  return blocks;
}

function parseClientFromLines(lines: string[]) {
  const addressIdx = lines.findIndex((line) => /^Client\s*(?:'|’)?s\s+address$/i.test(line));
  if (addressIdx < 1) return {};

  const before = cleanText(lines[addressIdx - 1]);
  const after = cleanText(lines[addressIdx + 1]);
  const firstName = before.split(/\s+/)[0] || '';
  const lastName = after.split(/\s+/)[0] || '';
  const name = /^[A-Z][A-Za-z'-]+$/.test(firstName) && /^[A-Z][A-Za-z'-]+$/.test(lastName)
    ? `${firstName} ${lastName}`
    : undefined;
  const addressLines = [before.split(/\s+/).slice(1).join(' '), after.split(/\s+/).slice(1).join(' ')];
  for (const line of lines.slice(addressIdx + 2)) {
    if (CONTACT_HEADING_PATTERN.test(line)) break;
    addressLines.push(line);
  }

  return {
    clientName: name,
    clientAddress: cleanText(addressLines.join(' ')) || undefined,
  };
}

function parseBlock(block: { relationship: string; lines: string[] }): CareCircleContact | null {
  const fields: Record<string, string> = {};
  let lastKey = '';

  for (const line of block.lines) {
    const inline = line.match(/^(NAME|ADDRESS|HOME PHONE|MOBILE PHONE|WORK PHONE|EMAIL|RELATIONSHIP):\s*(.*)$/i);
    if (inline) {
      lastKey = inline[1].toUpperCase();
      appendField(fields, lastKey, inline[2]);
      continue;
    }
    if (lastKey) appendField(fields, lastKey, line);
  }

  const name = cleanText(fields.NAME);
  if (!name) return null;
  const relationship = block.relationship === 'GP'
    ? 'GP'
    : cleanText(fields.RELATIONSHIP) || block.relationship;
  const phone = cleanText(fields['MOBILE PHONE'] || fields['HOME PHONE'] || fields['WORK PHONE']);
  const email = cleanText(fields.EMAIL);

  return {
    id: safeId(`${name}-${relationship}`),
    name,
    relationship,
    email,
    phone,
    permissionLevel: permissionForRelationship(relationship),
    verified: false,
    consentBasis: 'Imported from contact details export. Verify consent and permissions before sharing.',
    restrictions: fields.ADDRESS ? `Address on source: ${cleanText(fields.ADDRESS)}` : '',
    reviewDate: todayPlusMonths(3),
  };
}

function fieldFromSegment(segment: string, label: string) {
  const labels = 'NAME|ADDRESS|HOME PHONE|MOBILE PHONE|WORK PHONE|EMAIL|RELATIONSHIP';
  const match = segment.match(new RegExp(`${label}:\\s*(.*?)(?=\\s+(?:${labels}):|\\s+(?:GP|Father|Mother|Support Planning and Brokerage Service|Social Worker|Next of Kin|Emergency Contact|Family|Advocate)\\b|$)`, 'i'));
  return cleanText(match?.[1]);
}

function contactFromFields(relationship: string, fields: Record<string, string>): CareCircleContact | null {
  const name = cleanText(fields.NAME);
  if (!name) return null;
  const finalRelationship = relationship === 'GP'
    ? 'GP'
    : cleanText(fields.RELATIONSHIP) || relationship;
  const phone = cleanText(fields['MOBILE PHONE'] || fields['HOME PHONE'] || fields['WORK PHONE']);
  const email = cleanText(fields.EMAIL);

  return {
    id: safeId(`${name}-${finalRelationship}`),
    name,
    relationship: finalRelationship,
    email,
    phone,
    permissionLevel: permissionForRelationship(finalRelationship),
    verified: false,
    consentBasis: 'Imported from contact details export. Verify consent and permissions before sharing.',
    restrictions: fields.ADDRESS ? `Address on source: ${cleanText(fields.ADDRESS)}` : '',
    reviewDate: todayPlusMonths(3),
  };
}

function parseFlattenedContacts(joined: string) {
  const heading = /\b(GP|Father|Mother|Support Planning and Brokerage Service|Social Worker|Next of Kin|Emergency Contact|Family|Advocate)\b/g;
  const hits = Array.from(joined.matchAll(heading));
  const contacts: CareCircleContact[] = [];

  for (let i = 0; i < hits.length; i++) {
    const relationship = hits[i][1];
    const start = (hits[i].index || 0) + relationship.length;
    const end = i + 1 < hits.length ? hits[i + 1].index || joined.length : joined.length;
    const segment = joined.slice(start, end);
    const contact = contactFromFields(relationship, {
      NAME: fieldFromSegment(segment, 'NAME'),
      ADDRESS: fieldFromSegment(segment, 'ADDRESS'),
      'HOME PHONE': fieldFromSegment(segment, 'HOME PHONE'),
      'MOBILE PHONE': fieldFromSegment(segment, 'MOBILE PHONE'),
      'WORK PHONE': fieldFromSegment(segment, 'WORK PHONE'),
      EMAIL: fieldFromSegment(segment, 'EMAIL'),
      RELATIONSHIP: fieldFromSegment(segment, 'RELATIONSHIP'),
    });
    if (contact) contacts.push(contact);
  }

  return contacts;
}

function parseInlineFields(line: string, fields: Record<string, string>) {
  for (const label of ['NAME', 'ADDRESS', 'HOME PHONE', 'MOBILE PHONE', 'WORK PHONE', 'EMAIL', 'RELATIONSHIP']) {
    const value = fieldFromSegment(line, label);
    if (value) appendField(fields, label, value);
  }
}

function headingFromLine(line: string) {
  if (/^Support Planning and Brokerage\b/i.test(line) || /^Service\b/i.test(line)) {
    return 'Support Planning and Brokerage Service';
  }
  return line.match(/\b(GP|Father|Mother|Social Worker|Next of Kin|Emergency Contact|Family|Advocate)\b/i)?.[1] || '';
}

function parseOrderedLineContacts(lines: string[]) {
  const contacts: CareCircleContact[] = [];
  let fields: Record<string, string> | null = null;
  let relationship = '';

  const finalize = () => {
    if (!fields) return;
    const contact = contactFromFields(relationship || cleanText(fields.RELATIONSHIP) || 'Contact', fields);
    if (contact) contacts.push(contact);
    fields = null;
    relationship = '';
  };

  for (const line of lines) {
    if (/^NAME:/i.test(line)) {
      finalize();
      fields = {};
    }
    if (!fields) continue;
    parseInlineFields(line, fields);
    const heading = headingFromLine(line);
    if (heading) relationship = heading;
  }
  finalize();

  return contacts;
}

export function looksLikeContactDetailsExport(fileName: string, rawText: string) {
  const normalized = rawText.replace(/\s+/g, ' ').toLowerCase();
  return (
    fileName.toLowerCase().includes('contact') &&
    normalized.includes('contact details') &&
    normalized.includes('contact type') &&
    normalized.includes('details')
  ) || (
    normalized.includes('contact details') &&
    normalized.includes("client's address") &&
    normalized.includes('relationship:')
  );
}

export function parseContactDetailsExport(rawText: string): ContactDetailsImport {
  const lines = normalizeLines(rawText);
  const joined = lines.join(' ');
  const headerClient = joined.match(/\bClient\s+Contact\s+type\s+Details\s+([A-Z][A-Za-z'-]+)\s+([A-Z][A-Za-z'-]+)\b/i);
  const clientRow = joined.match(/\b([A-Z][A-Za-z'-]+)\s+([A-Z][A-Za-z'-]+)\s+Client\s*(?:'|’)?s\s+address\s+(.+?)(?=\s+(?:GP|Support Planning and Brokerage Service|Father|Mother)\b)/i);
  const lineClient = parseClientFromLines(lines);
  const clientAddress = clientRow ? cleanText(clientRow[3]) : lineClient.clientAddress;
  const lineContacts = linesToBlocks(lines).map(parseBlock).filter(Boolean) as CareCircleContact[];
  const flattenedContacts = parseFlattenedContacts(joined);
  const orderedContacts = parseOrderedLineContacts(lines);
  const contacts = mergeUniqueContacts(lineContacts, flattenedContacts, orderedContacts);
  const candidateName = lineClient.clientName || (clientRow ? `${clientRow[1]} ${clientRow[2]}` : headerClient ? `${headerClient[1]} ${headerClient[2]}` : undefined);
  const familySurnames = contacts
    .filter((contact) => /^(father|mother)$/i.test(contact.relationship))
    .map((contact) => cleanText(contact.name).split(/\s+/).at(-1) || '')
    .filter(Boolean);
  const sharedFamilySurname = familySurnames.length >= 2 && familySurnames.every((surname) => surname.toLowerCase() === familySurnames[0].toLowerCase())
    ? familySurnames[0]
    : '';
  const rawParentSurname = joined.match(/\bFather\s+NAME:?\s+[A-Z][A-Za-z'-]+\s+([A-Z][A-Za-z'-]+)[\s\S]*?\bMother\s+NAME:?\s+[A-Z][A-Za-z'-]+\s+\1\b/i)?.[1] || '';
  const evidenceSurname = sharedFamilySurname || rawParentSurname;
  const clientName = candidateName && evidenceSurname
    ? `${candidateName.split(/\s+/)[0]} ${evidenceSurname}`
    : candidateName;

  return { clientName, clientAddress, contacts };
}

function mergeUniqueContacts(...groups: CareCircleContact[][]) {
  const merged: CareCircleContact[] = [];
  const seen = new Set<string>();
  for (const contact of groups.flat()) {
    const key = `${contact.name.toLowerCase()}|${contact.relationship.toLowerCase()}|${contact.email.toLowerCase()}|${contact.phone.replace(/\s+/g, '')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(contact);
  }
  return merged;
}
