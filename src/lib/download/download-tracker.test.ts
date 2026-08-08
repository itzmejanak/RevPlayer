import { beforeEach, describe, expect, it } from "vitest";

import {
  deleteDownload,
  getDownload,
  listDownloads,
  putDownload,
  updateDownload,
} from "@/lib/download/download-tracker";
import type { DownloadRecord } from "@/types/video";

function makeRecord(
  overrides: Partial<DownloadRecord> = {},
): DownloadRecord {
  return {
    videoId: "video-1",
    sourceUrl: "https://example.com/video.mp4",
    totalBytes: 100,
    receivedBytes: 0,
    status: "downloading",
    rangeSupported: true,
    updatedAt: 1000,
    ...overrides,
  };
}

describe("download-tracker", () => {
  beforeEach(async () => {
    for (const record of await listDownloads()) {
      await deleteDownload(record.videoId);
    }
  });

  it("round-trips a download record", async () => {
    await putDownload(makeRecord());
    const record = await getDownload("video-1");
    expect(record?.sourceUrl).toBe("https://example.com/video.mp4");
    expect(record?.status).toBe("downloading");
  });

  it("returns undefined for a missing record", async () => {
    expect(await getDownload("nope")).toBeUndefined();
  });

  it("updates fields and bumps updatedAt", async () => {
    await putDownload(makeRecord({ updatedAt: 1000 }));
    await updateDownload("video-1", {
      receivedBytes: 50,
      status: "paused",
    });
    const record = await getDownload("video-1");
    expect(record?.receivedBytes).toBe(50);
    expect(record?.status).toBe("paused");
    expect(record?.updatedAt).toBeGreaterThanOrEqual(1000);
  });

  it("does not create a record on update when missing", async () => {
    await updateDownload("missing", { status: "complete" });
    expect(await getDownload("missing")).toBeUndefined();
  });

  it("lists records most-recently-updated first", async () => {
    await putDownload(makeRecord({ videoId: "a", updatedAt: 100 }));
    await putDownload(makeRecord({ videoId: "b", updatedAt: 300 }));
    await putDownload(makeRecord({ videoId: "c", updatedAt: 200 }));

    const records = await listDownloads();
    expect(records.map((record) => record.videoId)).toEqual(["b", "c", "a"]);
  });

  it("deletes a record", async () => {
    await putDownload(makeRecord());
    await deleteDownload("video-1");
    expect(await getDownload("video-1")).toBeUndefined();
  });
});
