import { requireNativeModule } from "expo";

export interface UsageEntry {
  packageName: string;
  label: string;
  minutes: number;
}

interface DeeprestUsageNativeModule {
  hasPermission(): boolean;
  openPermissionSettings(): void;
  getTodayUsage(): UsageEntry[];
}

// Throws at build/import time when the JS runs outside the custom dev
// client (e.g. Expo Go) — callers must guard with try/catch.
const NativeDeeprestUsage = requireNativeModule<DeeprestUsageNativeModule>("DeeprestUsage");

export function hasUsagePermission(): boolean {
  return NativeDeeprestUsage.hasPermission();
}

export function openUsagePermissionSettings(): void {
  NativeDeeprestUsage.openPermissionSettings();
}

/** Real per-app foreground minutes since local midnight. */
export function getTodayUsage(): UsageEntry[] {
  return NativeDeeprestUsage.getTodayUsage();
}

export default NativeDeeprestUsage;
