import { db } from './index.js';

export const settingDefaults = {
  'crawler.pageConcurrency': 3,
  'crawler.minDelayMs': 300,
  'crawler.maxUrls': 500,
  'crawler.requestTimeoutMs': 15000,
  'crawler.maxRetries': 2,
  'performance.enabled': false,
  'performance.maxPages': 4,
  'security.invitationExpiryHours': 48,
  'activity.retentionDays': 30,
  'activity.autoArchive': true,
} as const;
export type SettingKey = keyof typeof settingDefaults;
export type SettingValues = { [K in SettingKey]: typeof settingDefaults[K] extends boolean ? boolean : number };
export function validSetting(key: string, value: unknown): boolean {
  if (key === 'performance.enabled' || key === 'activity.autoArchive') return typeof value === 'boolean';
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return false;
  switch (key) {
    case 'crawler.pageConcurrency': return value >= 1 && value <= 12;
    case 'crawler.minDelayMs': return value >= 100 && value <= 10000;
    case 'crawler.maxUrls': return value >= 1 && value <= 10000;
    case 'crawler.requestTimeoutMs': return value >= 1000 && value <= 60000;
    case 'crawler.maxRetries': return value >= 0 && value <= 5;
    case 'performance.maxPages': return value >= 1 && value <= 4;
    case 'activity.retentionDays': return value >= 1 && value <= 365;
    case 'security.invitationExpiryHours': return value >= 1 && value <= 168;
    default: return false;
  }
}
export async function getApplicationSettings(): Promise<SettingValues> {
  const rows = await db.applicationSetting.findMany({ where: { key: { in: Object.keys(settingDefaults) } } });
  const result: Record<string, number | boolean> = { ...settingDefaults };
  for (const row of rows) {
    if (validSetting(row.key, row.value)) result[row.key] = row.value as number | boolean;
  }
  return result as SettingValues;
}
