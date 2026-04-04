const TEMPLATE_CONTEXT_KEY = 'hc-template-import-context';

export interface MonitoringTemplateContext {
  source: 'staff-monitoring';
  at: string;
  monitoringRunId?: string;
  house?: string;
  dateFrom?: string;
  dateTo?: string;
  escalationCount?: number;
  avgHouseQuality?: number;
}

export function mergeMonitoringIntoTemplateContext(patch: MonitoringTemplateContext): void {
  try {
    const raw = localStorage.getItem(TEMPLATE_CONTEXT_KEY);
    const base = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    localStorage.setItem(
      TEMPLATE_CONTEXT_KEY,
      JSON.stringify({
        ...base,
        ...patch,
        source: 'staff-monitoring',
        at: new Date().toISOString(),
      }),
    );
  } catch {
    localStorage.setItem(
      TEMPLATE_CONTEXT_KEY,
      JSON.stringify({ ...patch, source: 'staff-monitoring', at: new Date().toISOString() }),
    );
  }
}
