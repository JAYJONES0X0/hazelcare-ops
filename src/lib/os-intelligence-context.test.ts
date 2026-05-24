import { describe, expect, it } from 'vitest';
import { buildOsIntelligenceContextFromState } from './os-intelligence-context';
import type { CareEntry } from './types';

const entry = (patch: Partial<CareEntry>): CareEntry => ({
  id: patch.id || crypto.randomUUID(),
  date: patch.date || '20/04/2026',
  time: patch.time,
  house: patch.house || 'Brooklyn',
  type: patch.type || 'Handover',
  carer: patch.carer || 'Region Entry',
  client: patch.client || 'Wayne Jefferson',
  entry: patch.entry || '',
  severity: patch.severity || 'none',
  flags: patch.flags || [],
  category: patch.category,
});

describe('os intelligence context', () => {
  it('binds raw note, same-day evidence, roster, and care-plan context into one prompt block', () => {
    const target = entry({
      id: 'target',
      time: '12:30',
      entry: 'Wayne declined personal care but accepted lunch later.',
    });
    const context = buildOsIntelligenceContextFromState({
      clientName: 'Wayne Jefferson',
      entry: target,
      entries: [
        target,
        entry({ id: 'same-day', time: '08:30', entry: 'Wayne was calm and watched TV before breakfast.' }),
        entry({ id: 'before', date: '19/04/2026', entry: 'Wayne needed calm prompts around hygiene.' }),
      ],
      rosterShifts: [{
        id: 'r1',
        client: 'Wayne Jefferson',
        clientRaw: 'Wayne Jefferson',
        house: 'Brooklyn',
        date: '20/04/2026',
        startTime: '12:00',
        endTime: '14:00',
        carers: ['Basil Kurian'],
        durationHours: 2,
        shiftType: 'day',
      }],
      clientProfile: {
        id: 'c1',
        name: 'Wayne Jefferson',
        preferredName: 'Wayne',
        dob: '',
        nhs: '',
        address: '',
        phone: '',
        diagnoses: ['Autism'],
        carePlan: {
          biography: '',
          criticalInfo: 'Use calm, low-demand prompts.',
          domains: [],
        } as any,
      } as any,
    });

    expect(context).toContain('[OS INTELLIGENCE CONTRACT]');
    expect(context).toContain('Basil Kurian');
    expect(context).toContain('Wayne was calm and watched TV');
    expect(context).toContain('Use calm, low-demand prompts');
    expect(context).toContain('do not silently fix it');
  });
});
