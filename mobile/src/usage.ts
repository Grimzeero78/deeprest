/**
 * Safe wrapper around the native DeeprestUsage module.
 * The raw import throws if the JS runs outside the custom dev client
 * (e.g. Expo Go has no native code) — we degrade gracefully instead.
 */
export interface UsageEntry {
  packageName: string;
  label: string;
  minutes: number;
}

let native: {
  hasUsagePermission(): boolean;
  openUsagePermissionSettings(): void;
  getTodayUsage(): UsageEntry[];
} | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  native = require("../modules/deeprest-usage").default ?? require("../modules/deeprest-usage");
} catch {
  native = null;
}

export const isNativeAvailable = native !== null;

export function hasUsagePermission(): boolean {
  try {
    return native?.hasUsagePermission() ?? false;
  } catch {
    return false;
  }
}

export function openUsagePermissionSettings(): void {
  native?.openUsagePermissionSettings();
}

/** Real per-app foreground minutes since local midnight, or [] if unavailable. */
export function getTodayUsage(): UsageEntry[] {
  try {
    return native?.getTodayUsage() ?? [];
  } catch {
    return [];
  }
}

export interface SyncPayload {
  totalMinutes: number;
  topApps: { name: string; minutes: number }[];
}

/** Aggregate native entries into an API-ready payload (capped at 24h). */
export function buildSyncPayload(entries: UsageEntry[]): SyncPayload {
  const totalMinutes = Math.min(
    1440,
    entries.reduce((sum, e) => sum + e.minutes, 0)
  );
  const topApps = entries.slice(0, 5).map((e) => ({ name: e.label, minutes: e.minutes }));
  return { totalMinutes, topApps };
}
