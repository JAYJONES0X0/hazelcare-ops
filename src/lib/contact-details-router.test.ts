import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEnvelopeFromRaw } from './import-profiles';
import { routeImport } from './import-router';
import { emptyClient, loadClients, saveClient } from './client-store';

const CONTACT_DETAILS_TEXT = `
Contact details
Client Contact type Details
Alistair Gunn Client's address Hazelbury Lodge, 12 Hazelbury Road, Hengrove, Bristol, BS14 9ER
GP
NAME: Priory Surgery Administration Team
EMAIL: bnssg.priory.surgery@nhs.net
Father
NAME: Ken Gunn
MOBILE PHONE: 0117 914 9814
Mother
NAME: Susan Gunn
MOBILE PHONE: 07757593039
EMAIL: SusanGunn@virginmedia.com
`;

function storageMock() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) || null),
    setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
    removeItem: vi.fn((key: string) => { store.delete(key); }),
    clear: vi.fn(() => store.clear()),
  };
}

describe('contact details route import', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', storageMock());
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  });

  it('merges contact exports into the matched client Care Circle without wiping existing contacts', () => {
    const client = {
      ...emptyClient(),
      id: 'client-alistair',
      name: 'Alistair Gunn',
      preferredName: 'Alistair',
      careCircle: {
        mode: 'standard_family_window' as const,
        contacts: [{
          id: 'existing',
          name: 'Existing Sister',
          relationship: 'Sister',
          email: '',
          phone: '07700 900111',
          permissionLevel: 'reassurance' as const,
          verified: true,
          consentBasis: 'Already verified.',
          restrictions: '',
          reviewDate: '01/09/2026',
        }],
        updates: [],
        concerns: [],
        activity: [],
        notes: '',
      },
    };
    saveClient(client);

    const envelope = buildEnvelopeFromRaw('Contact-details.pdf', CONTACT_DETAILS_TEXT);
    const result = routeImport(envelope, { targets: ['client-docs'], clientMode: 'auto' });

    expect(result.ok).toBe(true);
    expect(result.messages.join(' ')).toContain('contacts merged');
    const updated = loadClients()[0];
    expect(updated.address).toContain('Hazelbury Lodge');
    expect(updated.careCircle?.mode).toBe('standard_family_window');
    expect(updated.careCircle?.contacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Existing Sister' }),
      expect.objectContaining({ name: 'Priory Surgery Administration Team', relationship: 'GP' }),
      expect.objectContaining({ name: 'Ken Gunn', relationship: 'Father' }),
      expect.objectContaining({ name: 'Susan Gunn', relationship: 'Mother' }),
    ]));
  });
});
