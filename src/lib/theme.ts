export type BaseTheme = 'light' | 'dark';
export type SkinTheme = 'authority' | 'critical' | 'clinical' | 'calm' | 'focus';
export type AppTheme = BaseTheme | SkinTheme;

const SKIN_THEMES = new Set<SkinTheme>(['authority', 'critical', 'clinical', 'calm', 'focus']);

export function normalizeTheme(value: string | null): AppTheme {
  if (value === 'dark') return 'dark';
  if (SKIN_THEMES.has(value as SkinTheme)) return value as SkinTheme;
  return 'light';
}

export function normalizeBaseTheme(value: string | null): BaseTheme {
  return value === 'dark' ? 'dark' : 'light';
}

export function isSkinTheme(value: AppTheme): value is SkinTheme {
  return SKIN_THEMES.has(value as SkinTheme);
}
