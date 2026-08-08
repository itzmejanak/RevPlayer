import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatBytes,
  getStorageUsage,
  requestPersistentStorage,
} from "@/lib/storage/quota";

type StorageMock = {
  estimate: ReturnType<typeof vi.fn>;
  persisted: ReturnType<typeof vi.fn>;
  persist: ReturnType<typeof vi.fn>;
};

function defineStorage(mock: StorageMock | undefined) {
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    value: mock,
  });
}

afterEach(() => {
  defineStorage(undefined);
});

describe("getStorageUsage", () => {
  it("returns zeros when storage is unsupported", async () => {
    defineStorage(undefined);
    await expect(getStorageUsage()).resolves.toEqual({
      usedBytes: 0,
      quotaBytes: 0,
      persisted: false,
    });
  });

  it("returns the estimate and persistence state", async () => {
    const mock: StorageMock = {
      estimate: vi.fn(async () => ({
        usage: 5_000_000,
        quota: 10_000_000_000,
        usageDetails: { indexedDB: 5_000_000 },
      })),
      persisted: vi.fn(async () => true),
      persist: vi.fn(),
    };
    defineStorage(mock);

    const usage = await getStorageUsage();
    expect(usage).toEqual({
      usedBytes: 5_000_000,
      quotaBytes: 10_000_000_000,
      usageDetails: { indexedDB: 5_000_000 },
      persisted: true,
    });
  });
});

describe("requestPersistentStorage", () => {
  it("returns false when unsupported", async () => {
    defineStorage(undefined);
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it("calls navigator.storage.persist", async () => {
    const mock: StorageMock = {
      estimate: vi.fn(),
      persisted: vi.fn(),
      persist: vi.fn(async () => true),
    };
    defineStorage(mock);

    await expect(requestPersistentStorage()).resolves.toBe(true);
    expect(mock.persist).toHaveBeenCalled();
  });
});

describe("formatBytes", () => {
  it("formats common byte sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(1536 * 1024)).toBe("1.5 MB");
    expect(formatBytes(2_500_000_000)).toBe("2.3 GB");
  });

  it("handles invalid input", () => {
    expect(formatBytes(NaN)).toBe("0 B");
    expect(formatBytes(-1)).toBe("0 B");
  });
});
