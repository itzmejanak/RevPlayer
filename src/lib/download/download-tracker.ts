import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { DownloadRecord } from "@/types/video";

const DB_NAME = "revplayer-downloads";
const DB_VERSION = 1;

interface DownloadTrackerDBSchema extends DBSchema {
  downloads: {
    key: string;
    value: DownloadRecord;
    indexes: {
      "by-updated-at": number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<DownloadTrackerDBSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<DownloadTrackerDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<DownloadTrackerDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const downloads = db.createObjectStore("downloads", {
          keyPath: "videoId",
        });
        downloads.createIndex("by-updated-at", "updatedAt");
      },
    });
  }
  return dbPromise;
}

export async function getDownload(
  videoId: string,
): Promise<DownloadRecord | undefined> {
  return (await getDb()).get("downloads", videoId);
}

export async function putDownload(record: DownloadRecord): Promise<void> {
  await (await getDb()).put("downloads", record);
}

export async function updateDownload(
  videoId: string,
  patch: Partial<DownloadRecord>,
): Promise<void> {
  const db = await getDb();
  const existing = await db.get("downloads", videoId);
  if (!existing) {
    return;
  }
  await db.put("downloads", {
    ...existing,
    ...patch,
    updatedAt: patch.updatedAt ?? Date.now(),
  });
}

export async function deleteDownload(videoId: string): Promise<void> {
  await (await getDb()).delete("downloads", videoId);
}

export async function listDownloads(): Promise<DownloadRecord[]> {
  const db = await getDb();
  const records = await db.getAllFromIndex("downloads", "by-updated-at");
  return records.reverse();
}
