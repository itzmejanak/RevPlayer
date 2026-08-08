import {
  getDownload,
  putDownload,
  deleteDownload,
  listDownloads,
} from "@/lib/download/download-tracker";
import { useDownloadStore } from "@/lib/download/download-store";
import { getDownloadBlobStore } from "@/lib/storage/opfs";
import { getVideo, updateVideo } from "@/lib/storage/metadata-db";
import type { DownloadRecord, Video } from "@/types/video";

export const CHUNK_SIZE = 4 * 1024 * 1024;
const MAX_RETRIES = 4;

export interface ProbeResult {
  totalBytes?: number;
  rangeSupported: boolean;
  contentType?: string;
}

export function parseContentRangeTotal(range: string | null): number | undefined {
  if (!range) return undefined;
  const match = range.match(/\/(\d+)$/);
  return match ? Number(match[1]) : undefined;
}

export async function probeSource(url: string): Promise<ProbeResult> {
  let totalBytes: number | undefined;
  let contentType: string | undefined;

  try {
    const res = await fetch(url, { method: "HEAD" });
    if (res.ok) {
      const length = res.headers.get("content-length");
      totalBytes = length ? Number(length) : undefined;
      contentType = res.headers.get("content-type") ?? undefined;
    }
  } catch {
    // Fall through to a ranged GET probe.
  }

  try {
    const res = await fetch(url, { headers: { Range: "bytes=0-0" } });
    if (res.status === 206) {
      return {
        totalBytes:
          totalBytes ?? parseContentRangeTotal(res.headers.get("content-range")),
        rangeSupported: true,
        contentType: contentType ?? res.headers.get("content-type") ?? undefined,
      };
    }
  } catch {
    // Ranges not confirmed; fall back to an unrestricted GET.
  }

  return { totalBytes, rangeSupported: false, contentType };
}

interface ActiveDownload {
  controller: AbortController;
  pauseRequested: boolean;
  cancelRequested: boolean;
}

const active = new Map<string, ActiveDownload>();

export function isDownloadActive(videoId: string): boolean {
  return active.has(videoId);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 8000);
}

async function fetchRange(
  url: string,
  start: number,
  end: number,
  ctx: ActiveDownload,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { Range: `bytes=${start}-${end}` },
        signal: ctx.controller.signal,
      });
      if (res.status === 416) return res;
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res;
    } catch (error) {
      if (ctx.controller.signal.aborted) throw error;
      lastError = error;
      await sleep(backoffMs(attempt), ctx.controller.signal);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Range fetch failed");
}

async function fetchFullStream(
  url: string,
  ctx: ActiveDownload,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const res = await fetch(url, { signal: ctx.controller.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res;
    } catch (error) {
      if (ctx.controller.signal.aborted) throw error;
      lastError = error;
      await sleep(backoffMs(attempt), ctx.controller.signal);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Fetch failed");
}

interface DownloadOptions {
  probe?: boolean;
}

export async function startDownload(
  videoId: string,
  options: DownloadOptions = {},
): Promise<void> {
  if (active.has(videoId)) return;

  const video = await getVideo(videoId);
  if (!video?.sourceUrl) return;

  const existing = await getDownload(videoId);
  const ctx: ActiveDownload = {
    controller: new AbortController(),
    pauseRequested: false,
    cancelRequested: false,
  };
  active.set(videoId, ctx);

  try {
    await runDownload(video, existing, ctx, options);
  } finally {
    active.delete(videoId);
  }
}

export function pauseDownload(videoId: string): void {
  const ctx = active.get(videoId);
  if (!ctx) return;
  ctx.pauseRequested = true;
  ctx.controller.abort();
}

export function cancelDownload(videoId: string): void {
  const ctx = active.get(videoId);
  if (ctx) {
    ctx.cancelRequested = true;
    ctx.controller.abort();
    return;
  }
  void removeDownloadData(videoId);
}

async function removeDownloadData(videoId: string): Promise<void> {
  const store = getDownloadBlobStore();
  await Promise.all([
    store.delete(videoId),
    deleteDownload(videoId),
    updateVideo(videoId, { status: "not-downloaded" }),
  ]);
  useDownloadStore.getState().remove(videoId);
}

async function runDownload(
  video: Video,
  existing: DownloadRecord | undefined,
  ctx: ActiveDownload,
  options: DownloadOptions,
): Promise<void> {
  const store = getDownloadBlobStore();
  const videoId = video.id;

  const probe =
    options.probe !== false
      ? await probeSource(video.sourceUrl!)
      : { totalBytes: existing?.totalBytes, rangeSupported: existing?.rangeSupported ?? false };

  const totalBytes = probe.totalBytes ?? existing?.totalBytes;
  const rangeSupported = probe.rangeSupported ?? existing?.rangeSupported ?? false;

  const storedSize = (await store.size(videoId)) ?? 0;
  const canResume =
    storedSize > 0 &&
    rangeSupported &&
    totalBytes !== undefined &&
    totalBytes > storedSize;

  let received = canResume ? Math.min(storedSize, existing?.receivedBytes ?? 0) : 0;
  const mode: "truncate" | "append" = canResume ? "append" : "truncate";
  const writer = await store.createWriter!(videoId, mode);

  let record: DownloadRecord = {
    videoId,
    sourceUrl: video.sourceUrl!,
    totalBytes: totalBytes ?? 0,
    receivedBytes: received,
    status: "downloading",
    rangeSupported,
    updatedAt: Date.now(),
  };
  await putDownload(record);
  await updateVideo(videoId, { status: "downloading" });
  useDownloadStore.getState().setProgress({
    videoId,
    status: "downloading",
    receivedBytes: received,
    totalBytes: totalBytes ?? 0,
    error: undefined,
  });

  const checkpoint = async () => {
    record = { ...record, receivedBytes: received, updatedAt: Date.now() };
    await putDownload(record);
    useDownloadStore.getState().setProgress({
      videoId,
      receivedBytes: received,
    });
  };

  try {
    if (totalBytes === undefined || !rangeSupported) {
      const res = await fetchFullStream(video.sourceUrl!, ctx);
      const reader = res.body!.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(new Blob([value], { type: probe.contentType ?? "" }));
        received += value.byteLength;
        await checkpoint();
      }
    } else {
      let offset = received;
      while (offset < totalBytes) {
        const end = Math.min(offset + CHUNK_SIZE - 1, totalBytes - 1);
        const res = await fetchRange(video.sourceUrl!, offset, end, ctx);
        if (res.status === 416) break;
        const reader = res.body!.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(new Blob([value], { type: probe.contentType ?? "" }));
          received += value.byteLength;
          await checkpoint();
        }
        offset = end + 1;
      }
    }

    await writer.close();
    await store.consolidate?.(videoId);

    record = {
      ...record,
      status: "complete",
      receivedBytes: received,
      updatedAt: Date.now(),
    };
    await putDownload(record);
    await updateVideo(videoId, {
      status: "complete",
      downloadedAt: Date.now(),
      sizeBytes: totalBytes ?? received,
    });
    useDownloadStore.getState().setProgress({
      videoId,
      status: "complete",
      receivedBytes: received,
    });
  } catch (error) {
    if (ctx.cancelRequested) {
      await writer.abort();
      await store.delete(videoId);
      await Promise.all([
        deleteDownload(videoId),
        updateVideo(videoId, { status: "not-downloaded" }),
      ]);
      useDownloadStore.getState().remove(videoId);
      return;
    }

    await writer.close();
    const status = ctx.pauseRequested ? "paused" : "failed";
    record = {
      ...record,
      status,
      receivedBytes: received,
      updatedAt: Date.now(),
    };
    await putDownload(record);
    await updateVideo(videoId, { status });
    useDownloadStore.getState().setProgress({
      videoId,
      status,
      receivedBytes: received,
      error: status === "failed" ? errorMessage(error) : undefined,
    });
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function getDownloads(): Promise<DownloadRecord[]> {
  const records = await listDownloads();
  for (const record of records) {
    if (record.status === "downloading" && !isDownloadActive(record.videoId)) {
      record.status = "paused";
      record.updatedAt = Date.now();
      await putDownload(record);
    }
  }
  return listDownloads();
}

export async function hydrateDownloads(): Promise<void> {
  const records = await getDownloads();
  useDownloadStore.getState().hydrate(
    records.map((record) => ({
      videoId: record.videoId,
      status: record.status,
      receivedBytes: record.receivedBytes,
      totalBytes: record.totalBytes,
    })),
  );
}
