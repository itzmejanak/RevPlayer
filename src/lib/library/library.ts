import { getDownloadBlobStore } from "@/lib/storage/opfs";
import {
  deleteVideo,
  putVideo,
} from "@/lib/storage/metadata-db";
import { deleteDownload } from "@/lib/download/download-tracker";
import { probeSource } from "@/lib/download/download-manager";
import { useDownloadStore } from "@/lib/download/download-store";
import type { Video } from "@/types/video";

export function createVideoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `video-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^/.]+$/, "");
  return base.trim() || fileName;
}

export async function importLocalFile(file: File): Promise<Video> {
  const store = getDownloadBlobStore();
  const video: Video = {
    id: createVideoId(),
    title: titleFromFileName(file.name),
    sourceKind: "local-file",
    sizeBytes: file.size,
    tags: [],
    createdAt: Date.now(),
    status: "complete",
    downloadedAt: Date.now(),
  };

  await store.write(video.id, file);
  await putVideo(video);
  return video;
}

export async function addFromUrl(url: string): Promise<Video> {
  let sizeBytes: number | undefined;
  try {
    const probe = await probeSource(url);
    sizeBytes = probe.totalBytes;
  } catch {
    sizeBytes = undefined;
  }

  const video: Video = {
    id: createVideoId(),
    title: titleFromUrl(url),
    description: url,
    sourceKind: "remote-url",
    sourceUrl: url,
    sizeBytes,
    tags: [],
    createdAt: Date.now(),
    status: "not-downloaded",
  };

  await putVideo(video);
  return video;
}

export async function deleteVideoData(id: string): Promise<void> {
  const store = getDownloadBlobStore();
  await Promise.all([
    store.delete(id),
    deleteDownload(id),
    deleteVideo(id),
  ]);
  useDownloadStore.getState().remove(id);
}

export function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split("/").filter(Boolean).pop();
    if (last) {
      return decodeURIComponent(last.replace(/\.[^/.]+$/, ""));
    }
    return parsed.hostname;
  } catch {
    return url;
  }
}

export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || Number.isNaN(bytes)) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = "B";
  for (const next of units) {
    if (value < 1024) break;
    value /= 1024;
    unit = next;
  }
  return `${value.toFixed(1)} ${unit}`;
}

export function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || Number.isNaN(seconds)) return "";
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const mm = String(minutes).padStart(hours > 0 ? 2 : 1, "0");
  const ss = String(secs).padStart(2, "0");
  return hours > 0
    ? `${hours}:${mm}:${ss}`
    : `${minutes}:${ss}`;
}
