import type { StorageUsage } from "@/types/video";

type StorageEstimateWithDetails = StorageEstimate & {
  usageDetails?: Record<string, number>;
};

export async function getStorageUsage(): Promise<StorageUsage> {
  if (typeof navigator === "undefined" || !navigator.storage) {
    return { usedBytes: 0, quotaBytes: 0, persisted: false };
  }

  const [estimate, persisted] = await Promise.all([
    navigator.storage.estimate?.() ??
      Promise.resolve({ usage: 0, quota: 0 }),
    navigator.storage.persisted?.() ?? Promise.resolve(false),
  ]);

  return {
    usedBytes: estimate.usage ?? 0,
    quotaBytes: estimate.quota ?? 0,
    usageDetails: (estimate as StorageEstimateWithDetails).usageDetails,
    persisted,
  };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return false;
  }
  return navigator.storage.persist();
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }
  if (bytes === 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** index;
  return `${
    index === 0 || value >= 100 ? Math.round(value) : value.toFixed(1)
  } ${units[index]}`;
}
