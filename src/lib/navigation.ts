import type { Page } from './types';

export type MainSectionId =
  | 'mission-control'
  | 'clinical-intelligence'
  | 'forensic-documentation'
  | 'operations-personnel'
  | 'system-governance'
  | 'comms';

export interface SectionTab {
  id: Page;
  label: string;
}

export interface MainSection {
  id: MainSectionId;
  label: string;
  landing: Page;
  tabs: SectionTab[];
}

export const MAIN_SECTIONS: MainSection[] = [
  {
    id: 'mission-control',
    label: 'Mission Control',
    landing: 'dashboard',
    tabs: [
      { id: 'briefing', label: 'Strategy Briefing' },
      { id: 'dashboard', label: 'Sitrep Center' },
      { id: 'empire-matrix', label: 'Empire Matrix' },
      { id: 'communications', label: 'Comms Intercept' },
    ],
  },
  {
    id: 'clinical-intelligence',
    label: 'Clinical Intelligence',
    landing: 'client-diary',
    tabs: [
      { id: 'client-diary', label: 'Live Feed' },
      { id: 'client-docs', label: 'Sovereign Vault' },
      { id: 'risk', label: 'Risk Matrix' },
      { id: 'reports', label: 'Regulatory Audit' },
      { id: 'staff-tools', label: 'Staff Tools' },
    ],
  },
  {
    id: 'forensic-documentation',
    label: 'Forensic Documentation',
    landing: 'staff-monitoring',
    tabs: [
      { id: 'staff-monitoring', label: 'Force Protection' },
      { id: 'handover', label: 'Shift Handovers' },
      { id: 'nourish-tasks', label: 'Nourish Task Packs' },
      { id: 'note-workspace', label: 'AI Note Workspace' },
      { id: 'templates', label: 'Builder Templates' },
      { id: 'training-hub', label: 'Sovereign Trainer' },
    ],
  },
  {
    id: 'operations-personnel',
    label: 'Operations & Personnel',
    landing: 'staff',
    tabs: [
      { id: 'staff', label: 'Personnel Ledger' },
      { id: 'compliance', label: 'Personnel Audit' },
      { id: 'actions', label: 'Command Vectors' },
      { id: 'incidents', label: 'Incident Log' },
      { id: 'agency', label: 'External Support' },
      { id: 'upload', label: 'Field Ingest' },
    ],
  },
  {
    id: 'system-governance',
    label: 'System Governance',
    landing: 'settings',
    tabs: [
      { id: 'settings', label: 'System Settings' },
      { id: 'admin', label: 'Admin Matrix' },
    ],
  },
  {
    id: 'comms',
    label: 'Comms',
    landing: 'communications',
    tabs: [{ id: 'communications', label: 'Comms Intercept' }],
  },
];

export function getSectionByPage(page: Page): MainSection {
  return (
    MAIN_SECTIONS.find((section) => section.tabs.some((tab) => tab.id === page)) ??
    MAIN_SECTIONS[0]
  );
}
