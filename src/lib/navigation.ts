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
    label: 'Command Centre',
    landing: 'dashboard',
    tabs: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'upload', label: 'Import Hub' },
      { id: 'briefing', label: 'Briefing' },
      { id: 'client-diary', label: 'Care Logs' },
      { id: 'staff-monitoring', label: 'Staff Monitoring' },
    ],
  },
  {
    id: 'clinical-intelligence',
    label: 'Client Care',
    landing: 'client-docs',
    tabs: [
      { id: 'client-docs', label: 'Client Records' },
      { id: 'nourish-tasks', label: 'Task Packs' },
      { id: 'risk', label: 'Risk & PBS' },
      { id: 'reports', label: 'Audit Reports' },
    ],
  },
  {
    id: 'operations-personnel',
    label: 'Staff & Shifts',
    landing: 'staff',
    tabs: [
      { id: 'staff', label: 'Staff Directory' },
      { id: 'handover', label: 'Handovers' },
      { id: 'compliance', label: 'Training & DBS' },
      { id: 'agency', label: 'Agency Cover' },
      { id: 'actions', label: 'Action Log' },
      { id: 'incidents', label: 'Incidents' },
    ],
  },
  {
    id: 'forensic-documentation',
    label: 'Notes & Documents',
    landing: 'notes',
    tabs: [
      { id: 'notes', label: 'Staff Note' },
      { id: 'note-workspace', label: 'Note Workspace' },
      { id: 'training-hub', label: 'Writing Coach' },
      { id: 'templates', label: 'Templates' },
      { id: 'communications', label: 'Comms' },
    ],
  },
  {
    id: 'system-governance',
    label: 'System',
    landing: 'settings',
    tabs: [
      { id: 'settings', label: 'Settings' },
      { id: 'admin', label: 'Admin & Backup' },
      { id: 'empire-matrix', label: 'Regional Overview' },
    ],
  },
];

export function getSectionByPage(page: Page): MainSection {
  return (
    MAIN_SECTIONS.find((section) => section.tabs.some((tab) => tab.id === page)) ??
    MAIN_SECTIONS[0]
  );
}
