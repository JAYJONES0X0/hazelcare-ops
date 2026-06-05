import { describe, expect, it } from 'vitest';
import { TEMPLATES, type CareEntry, type WeekSummary } from './types';
import { buildTemplateDocument } from './template-doc-renderer';

function entry(overrides: Partial<CareEntry>): CareEntry {
  return {
    id: overrides.id || 'entry-1',
    date: overrides.date || '02/06/2026',
    time: overrides.time || '09:15',
    house: overrides.house || 'Hazelbury House',
    type: overrides.type || 'Daily note',
    carer: overrides.carer || 'Alex Reed',
    client: overrides.client || 'Jamie Morton',
    entry: overrides.entry || 'Staff completed checks and recorded a stable presentation.',
    severity: overrides.severity || 'green',
    flags: overrides.flags || [],
    category: overrides.category || 'daily_support',
  };
}

function weekSummary(): WeekSummary {
  const incident = entry({
    id: 'incident-1',
    category: 'incident',
    severity: 'red',
    flags: ['fall', 'manager-review'],
    entry: 'Client fell in the lounge and required immediate welfare checks and manager review.',
  });
  const medication = entry({
    id: 'med-1',
    category: 'medication',
    severity: 'amber',
    flags: ['mar-check'],
    entry: 'Medication stock count mismatch was identified and requires reconciliation.',
  });
  const finance = entry({
    id: 'finance-1',
    category: 'finance',
    severity: 'amber',
    flags: ['receipt-missing'],
    entry: 'Client money record is missing one receipt and needs audit follow-up.',
  });
  const staff = entry({
    id: 'staff-1',
    category: 'staff',
    severity: 'green',
    carer: 'Morgan Lee',
    entry: 'Staff supervision completed with refresher training agreed.',
  });
  const safeguarding = entry({
    id: 'safe-1',
    category: 'safeguarding',
    severity: 'red',
    flags: ['safeguarding'],
    entry: 'Safeguarding concern raised and escalated to the registered manager.',
  });
  const healthSafety = entry({
    id: 'repair-1',
    category: 'health_safety',
    severity: 'amber',
    flags: ['repair'],
    entry: 'Loose handrail reported and maintenance follow-up required.',
  });
  const handover = entry({
    id: 'handover-1',
    category: 'handover',
    severity: 'green',
    entry: 'Night shift handed over unsettled sleep pattern and morning reassurance plan.',
  });
  const daily = entry({
    id: 'daily-1',
    category: 'daily_support',
    severity: 'green',
    entry: 'Daily support completed with no concerns raised.',
  });
  const entries = [incident, medication, finance, staff, safeguarding, healthSafety, handover, daily];

  return {
    dateFrom: '01/06/2026',
    dateTo: '07/06/2026',
    totalEntries: entries.length,
    houses: {
      hazelbury: {
        name: 'Hazelbury House',
        coordinator: 'Pat Morgan',
        entries,
        incidents: [incident],
        safeguarding: [safeguarding],
        medication: [medication],
        staffPerformance: [staff],
        healthSafety: [healthSafety],
        handovers: [handover],
        dailySupport: [daily],
        flags: { red: 2, amber: 3, green: 3 },
      },
    },
    allFlags: {
      red: [incident, safeguarding],
      amber: [medication, finance, healthSafety],
      green: [staff, handover, daily],
    },
    entryTypes: { 'Daily note': entries.length },
    clients: ['Jamie Morton'],
    carers: ['Alex Reed', 'Morgan Lee'],
    clientDiary: { 'Jamie Morton': entries },
  };
}

describe('template document renderer', () => {
  it('renders every outputable template with governance sections and no generic placeholder', () => {
    const data = weekSummary();

    for (const template of TEMPLATES) {
      const html = buildTemplateDocument(data, template.id, null, { reviewer: 'Brook', approved: true });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Unit Accountability Matrix');
      expect(html).toContain('Operational Readout');
      expect(html).toContain('class="actions"');
      expect(html).toContain('Brook');
      expect(html).not.toContain('SYNTHESISING_DETAILED_TELEMETRY');
      expect(html).not.toContain('NO_INCIDENTS_LOGGED_FOR_PERIOD');
    }
  });

  it('documents a nil return instead of pretending the template is still synthesising', () => {
    const data = weekSummary();
    data.houses.hazelbury.medication = [];
    data.houses.hazelbury.entries = data.houses.hazelbury.entries.filter((item) => item.category !== 'medication');

    const html = buildTemplateDocument(data, 'medication_audit');

    expect(html).toContain('Nil return');
    expect(html).toContain('Medication Safety Actions');
    expect(html).not.toContain('SYNTHESISING_DETAILED_TELEMETRY');
  });
});
