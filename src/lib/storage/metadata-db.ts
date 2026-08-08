import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { DownloadStatus, Video, WatchProgress } from "@/types/video";

const DB_NAME = "revplayer";
const DB_VERSION = 1;

interface RevPlayerDBSchema extends DBSchema {
  videos: {
    key: string;
    value: Video;
    indexes: {
      "by-status": DownloadStatus;
      "by-created-at": number;
    };
  };
  progress: {
    key: string;
    value: WatchProgress;
  };
}

let dbPromise: Promise<IDBPDatabase<RevPlayerDBSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<RevPlayerDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<RevPlayerDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const videos = db.createObjectStore("videos", { keyPath: "id" });
        videos.createIndex("by-status", "status");
        videos.createIndex("by-created-at", "createdAt");
        db.createObjectStore("progress", { keyPath: "videoId" });
      },
    });
  }
  return dbPromise;
}

export async function getVideo(id: string): Promise<Video | undefined> {
  return (await getDb()).get("videos", id);
}

export async function putVideo(video: Video): Promise<string> {
  await (await getDb()).put("videos", video);
  return video.id;
}

export async function updateVideo(
  id: string,
  patch: Partial<Video>,
): Promise<void> {
  const db = await getDb();
  const existing = await db.get("videos", id);
  if (!existing) {
    return;
  }
  await db.put("videos", { ...existing, ...patch });
}

export async function deleteVideo(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["videos", "progress"], "readwrite");
  await Promise.all([
    tx.objectStore("videos").delete(id),
    tx.objectStore("progress").delete(id),
  ]);
  await tx.done;
}

export async function listVideos(): Promise<Video[]> {
  const db = await getDb();
  const videos = await db.getAllFromIndex("videos", "by-created-at");
  return videos.reverse();
}

export async function listVideosByStatus(
  status: DownloadStatus,
): Promise<Video[]> {
  const db = await getDb();
  return db.getAllFromIndex("videos", "by-status", status);
}

export async function countVideos(): Promise<number> {
  return (await getDb()).count("videos");
}

export async function getProgress(
  videoId: string,
): Promise<WatchProgress | undefined> {
  return (await getDb()).get("progress", videoId);
}

export async function putProgress(progress: WatchProgress): Promise<void> {
  await (await getDb()).put("progress", progress);
}

export async function deleteProgress(videoId: string): Promise<void> {
  await (await getDb()).delete("progress", videoId);
}

export async function clearLibrary(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["videos", "progress"], "readwrite");
  await Promise.all([
    tx.objectStore("videos").clear(),
    tx.objectStore("progress").clear(),
  ]);
  await tx.done;
}
