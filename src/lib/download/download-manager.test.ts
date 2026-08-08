import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CHUNK_SIZE,
  cancelDownload,
  getDownloads,
  isDownloadActive,
  parseContentRangeTotal,
  pauseDownload,
  probeSource,
  startDownload,
} from "@/lib/download/download-manager";
import { getDownload } from "@/lib/download/download-tracker";
import { useDownloadStore } from "@/lib/download/download-store";
import { clearLibrary, getVideo, putVideo } from "@/lib/storage/metadata-db";
import type { Video } from "@/types/video";

let nextVideoId = 0;

function makeVideo(url: string): Video {
  nextVideoId += 1;
  const id = `video-${nextVideoId}`;
  return {
    id,
    title: `Video ${id}`,
    sourceKind: "remote-url",
    sourceUrl: url,
    tags: [],
    createdAt: Date.now(),
    status: "not-downloaded",
  };
}

let serverData: Uint8Array<ArrayBuffer>;
let headStatus: number;
let resolveSecondRange: (() => void) | null;
let gateArmed = true;

function makeAbortAwareStream(
  chunks: Uint8Array[],
  signal: AbortSignal,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (signal.aborted) {
        controller.error(signal.reason ?? new DOMException("Aborted", "AbortError"));
        return;
      }
      const chunk = chunks.shift();
      if (!chunk) {
        controller.close();
        return;
      }
      controller.enqueue(chunk);
    },
    cancel() {},
  });
}

beforeEach(async () => {
  serverData = new Uint8Array(CHUNK_SIZE + 1000);
  for (let i = 0; i < serverData.byteLength; i += 1) {
    serverData[i] = i % 251;
  }
  headStatus = 200;
  resolveSecondRange = null;
  gateArmed = true;
  await clearLibrary();

  const fetchMock = vi.fn(
    async (_url: string, init: RequestInit = {}) => {
      const signal = init.signal as AbortSignal;
      if (init.method === "HEAD") {
        return new Response(null, {
          status: headStatus,
          headers: { "content-length": String(serverData.byteLength) },
        });
      }
      if (signal?.aborted) {
        throw signal.reason ?? new DOMException("Aborted", "AbortError");
      }
      const range = init.headers as Record<string, string> | undefined;
      if (range?.Range) {
        const match = String(range.Range).match(/bytes=(\d+)-(\d+)/);
        const start = Number(match![1]);
        const end = Number(match![2]);
        if (start >= serverData.byteLength) {
          return new Response(null, { status: 416 });
        }
        if (start >= CHUNK_SIZE && gateArmed) {
          gateArmed = false;
          const gate = new Promise<void>((resolve) => {
            resolveSecondRange = resolve;
          });
          await gate;
          if (signal.aborted) {
            throw signal.reason ?? new DOMException("Aborted", "AbortError");
          }
        }
        const slice = serverData.slice(start, end + 1);
        return new Response(
          makeAbortAwareStream([slice], signal),
          {
            status: 206,
            headers: {
              "content-range": `bytes ${start}-${end}/${serverData.byteLength}`,
            },
          },
        );
      }
      return new Response(makeAbortAwareStream([serverData], signal), {
        status: 200,
        headers: { "content-length": String(serverData.byteLength) },
      });
    },
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resolveSecondRange = null;
  useDownloadStore.setState({ downloads: {} });
});

describe("parseContentRangeTotal", () => {
  it("extracts the total from a content-range header", () => {
    expect(parseContentRangeTotal("bytes 0-0/100")).toBe(100);
    expect(parseContentRangeTotal("bytes 0-999/1000")).toBe(1000);
    expect(parseContentRangeTotal("bytes 0-0/*")).toBeUndefined();
    expect(parseContentRangeTotal(null)).toBeUndefined();
  });
});

describe("probeSource", () => {
  it("uses HEAD for size, then a ranged GET to confirm support", async () => {
    headStatus = 200;
    const result = await probeSource("https://example.com/v.mp4");
    expect(result.rangeSupported).toBe(true);
    expect(result.totalBytes).toBe(serverData.byteLength);
  });

  it("falls back to a ranged GET when HEAD is rejected", async () => {
    headStatus = 405;
    const result = await probeSource("https://example.com/v.mp4");
    expect(result.rangeSupported).toBe(true);
    expect(result.totalBytes).toBe(serverData.byteLength);
  });
});

describe("download manager", () => {
  it("downloads a range-supporting file and records completion", async () => {
    serverData = new Uint8Array(1000);
    const video = makeVideo("https://example.com/v.mp4");
    await putVideo(video);

    await startDownload(video.id);

    const record = await getDownload(video.id);
    expect(record?.status).toBe("complete");
    expect(record?.receivedBytes).toBe(serverData.byteLength);
    expect(record?.totalBytes).toBe(serverData.byteLength);
    expect(record?.rangeSupported).toBe(true);

    const stored = await getVideo(video.id);
    expect(stored?.status).toBe("complete");
    expect(useDownloadStore.getState().downloads[video.id]?.status).toBe("complete");
  });

  it("pauses and keeps received bytes", async () => {
    const video = makeVideo("https://example.com/v.mp4");
    await putVideo(video);

    const task = startDownload(video.id);
    await vi.waitFor(() => expect(resolveSecondRange).not.toBeNull());
    pauseDownload(video.id);
    resolveSecondRange!();
    await task;

    const record = await getDownload(video.id);
    expect(record?.status).toBe("paused");
    expect(record?.receivedBytes).toBe(CHUNK_SIZE);
  });

  it("resumes an interrupted download from the stored bytes", async () => {
    const video = makeVideo("https://example.com/v.mp4");
    await putVideo(video);

    const first = startDownload(video.id);
    await vi.waitFor(() => expect(resolveSecondRange).not.toBeNull());
    pauseDownload(video.id);
    resolveSecondRange!();
    await first;
    expect((await getDownload(video.id))?.status).toBe("paused");

    const second = startDownload(video.id);
    await second;

    const record = await getDownload(video.id);
    expect(record?.status).toBe("complete");
    expect(record?.receivedBytes).toBe(serverData.byteLength);
  });

  it("cancels a download and removes its data", async () => {
    const video = makeVideo("https://example.com/v.mp4");
    await putVideo(video);

    const task = startDownload(video.id);
    await vi.waitFor(() => expect(resolveSecondRange).not.toBeNull());
    cancelDownload(video.id);
    resolveSecondRange!();
    await task;

    expect(await getDownload(video.id)).toBeUndefined();
    const stored = await getVideo(video.id);
    expect(stored?.status).toBe("not-downloaded");
    expect(useDownloadStore.getState().downloads[video.id]).toBeUndefined();
  });

  it("falls back to a full-stream download when ranges are unsupported", async () => {
    headStatus = 405;
    const video = makeVideo("https://example.com/v.mp4");
    await putVideo(video);

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (url, init) => {
      if (init?.method === "HEAD") {
        return new Response(null, { status: 405 });
      }
      const range = init?.headers as Record<string, string> | undefined;
      if (range?.Range) {
        return new Response(null, { status: 200, headers: {} });
      }
      return new Response(serverData, {
        status: 200,
        headers: { "content-length": String(serverData.byteLength) },
      });
    });

    await startDownload(video.id);

    const record = await getDownload(video.id);
    expect(record?.status).toBe("complete");
    expect(record?.rangeSupported).toBe(false);
    expect(record?.receivedBytes).toBe(serverData.byteLength);
  });

  it("reports active state and hydrates stale records as paused", async () => {
    const video = makeVideo("https://example.com/v.mp4");
    await putVideo(video);
    expect(isDownloadActive(video.id)).toBe(false);

    const task = startDownload(video.id);
    await vi.waitFor(() => expect(isDownloadActive(video.id)).toBe(true));
    await vi.waitFor(() => expect(resolveSecondRange).not.toBeNull());
    pauseDownload(video.id);
    resolveSecondRange!();
    await task;
    expect(isDownloadActive(video.id)).toBe(false);

    const entries = await getDownloads();
    expect(entries[0]?.status).toBe("paused");
    expect(useDownloadStore.getState().downloads[video.id]?.status).toBe("paused");
  });
});
