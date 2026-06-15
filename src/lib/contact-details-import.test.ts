import { describe, expect, it } from 'vitest';
import { buildEnvelopeFromRaw } from './import-profiles';

const CONTACT_DETAILS_TEXT = `
Contact details
Client Contact type Details
Alistair Gunn Client's address Hazelbury Lodge, 12 Hazelbury Road, Hengrove, Bristol, BS14 9ER
GP
NAME: Priory Surgery Administration Team
ADDRESS: Priory Surgery 326 Wells Road Knowle Bristol BS4 2QJ
HOME PHONE: 0117 9493988
MOBILE PHONE: 0117 9493988
WORK PHONE: 0117 9493988
EMAIL: bnssg.priory.surgery@nhs.net
RELATIONSHIP: Administration Team
Support Planning and Brokerage Service
NAME: Theresa Cook
ADDRESS: 100 Temple Street Bristol BS1 6AG
HOME PHONE: 0117 35 21326
MOBILE PHONE: 07392108938
EMAIL: theresa.cook@bristol.gov.uk
Father
NAME: Ken Gunn
MOBILE PHONE: 0117 914 9814
Mother
NAME: Susan Gunn
HOME PHONE: 01173 730777
MOBILE PHONE: 07757593039
EMAIL: SusanGunn@virginmedia.com
`;

describe('contact details import', () => {
  it('detects a contact details export and maps family/professional contacts', () => {
    const envelope = buildEnvelopeFromRaw('Contact-details.pdf', CONTACT_DETAILS_TEXT);

    expect(envelope.source.detectedType).toBe('contact-details');
    expect(envelope.suggestedTargets).toEqual(['client-docs']);
    expect(envelope.clientCandidates[0]).toMatchObject({ name: 'Alistair Gunn' });
    expect(envelope.contactDetails?.clientAddress).toContain('Hazelbury Lodge');

    expect(envelope.contactDetails?.contacts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'Priory Surgery Administration Team',
        relationship: 'GP',
        email: 'bnssg.priory.surgery@nhs.net',
        permissionLevel: 'professional',
      }),
      expect.objectContaining({
        name: 'Theresa Cook',
        relationship: 'Support Planning and Brokerage Service',
        email: 'theresa.cook@bristol.gov.uk',
        permissionLevel: 'professional',
      }),
      expect.objectContaining({
        name: 'Ken Gunn',
        relationship: 'Father',
        phone: '0117 914 9814',
        permissionLevel: 'reassurance',
      }),
      expect.objectContaining({
        name: 'Susan Gunn',
        relationship: 'Mother',
        email: 'SusanGunn@virginmedia.com',
        permissionLevel: 'reassurance',
      }),
    ]));
  });
});
