import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export const OPFS_DIR = "revplayer-videos";

export interface BlobWriter {
  write(blob: Blob): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

export interface BlobStore {
  name: "opfs" | "cache" | "idb";
  write(key: string, blob: Blob): Promise<void>;
  read(key: string): Promise<Blob | undefined>;
  delete(key: string): Promise<void>;
  size(key: string): Promise<number | undefined>;
  createWriter?(key: string, mode: "truncate" | "append"): Promise<BlobWriter>;
  consolidate?(key: string): Promise<void>;
}

export function sanitizeKey(key: string): string {
  const safe = key
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "");
  return safe || "file";
}

export function isOpfsSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.storage?.getDirectory === "function"
  );
}

async function getDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(OPFS_DIR, { create: true });
}

export function createOpfsStore(): BlobStore {
  return {
    name: "opfs",
    async write(key, blob) {
      const dir = await getDir();
      const handle = await dir.getFileHandle(sanitizeKey(key), {
        create: true,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    },
    async read(key) {
      const dir = await getDir();
      try {
        const handle = await dir.getFileHandle(sanitizeKey(key));
        return await handle.getFile();
      } catch {
        return undefined;
      }
    },
    async delete(key) {
      const dir = await getDir();
      try {
        await dir.removeEntry(sanitizeKey(key));
      } catch {
        // Entry already gone.
      }
    },
    async size(key) {
      const dir = await getDir();
      try {
        const handle = await dir.getFileHandle(sanitizeKey(key));
        return (await handle.getFile()).size;
      } catch {
        return undefined;
      }
    },
    async createWriter(key, mode) {
      const dir = await getDir();
      const handle = await dir.getFileHandle(sanitizeKey(key), {
        create: true,
      });
      const writable =
        mode === "append"
          ? await handle.createWritable({ keepExistingData: true })
          : await handle.createWritable();
      if (mode === "append") {
        const file = await handle.getFile();
        await writable.seek(file.size);
      }
      return {
        async write(blob) {
          await writable.write(blob);
        },
        async close() {
          await writable.close();
        },
        async abort() {
          await writable.abort();
        },
      };
    },
  };
}

const BLOBS_CACHE = "revplayer-blobs-v1";

export function isCacheStoreSupported(): boolean {
  return typeof caches !== "undefined";
}

function cacheUrl(key: string): string {
  return `https://revplayer.local/${sanitizeKey(key)}`;
}

export function createCacheStore(): BlobStore {
  return {
    name: "cache",
    async write(key, blob) {
      const cache = await caches.open(BLOBS_CACHE);
      await cache.put(cacheUrl(key), new Response(blob));
    },
    async read(key) {
      const cache = await caches.open(BLOBS_CACHE);
      const response = await cache.match(cacheUrl(key));
      return response ? await response.blob() : undefined;
    },
    async delete(key) {
      const cache = await caches.open(BLOBS_CACHE);
      await cache.delete(cacheUrl(key));
    },
    async size(key) {
      const cache = await caches.open(BLOBS_CACHE);
      const response = await cache.match(cacheUrl(key));
      return response ? (await response.blob()).size : undefined;
    },
  };
}

interface BlobDBSchema extends DBSchema {
  blobs: {
    key: string;
    value: { key: string; bytes: ArrayBuffer; type: string; size: number };
  };
  chunks: {
    key: string;
    value: { key: string; videoKey: string; index: number; bytes: ArrayBuffer; size: number };
    indexes: { "by-key": string };
  };
}

const BLOB_DB_NAME = "revplayer-blobs";
const BLOB_DB_VERSION = 2;

let blobDbPromise: Promise<IDBPDatabase<BlobDBSchema>> | null = null;

function getBlobDb(): Promise<IDBPDatabase<BlobDBSchema>> {
  if (!blobDbPromise) {
    blobDbPromise = openDB<BlobDBSchema>(BLOB_DB_NAME, BLOB_DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains("blobs")) {
          db.createObjectStore("blobs", { keyPath: "key" });
        }
        if (oldVersion < 2 && !db.objectStoreNames.contains("chunks")) {
          const chunks = db.createObjectStore("chunks", { keyPath: "key" });
          chunks.createIndex("by-key", "videoKey");
        }
      },
    });
  }
  return blobDbPromise;
}

function chunkKey(key: string, index: number): string {
  return `${sanitizeKey(key)}__${index}`;
}

async function getChunkRecords(
  db: IDBPDatabase<BlobDBSchema>,
  key: string
): Promise<Array<BlobDBSchema["chunks"]["value"]>> {
  const safeKey = sanitizeKey(key);
  const records = await db.getAllFromIndex("chunks", "by-key", safeKey);
  return records.sort((a, b) => a.index - b.index);
}

async function toRecord(key: string, blob: Blob): Promise<BlobDBSchema["blobs"]["value"]> {
  return {
    key: sanitizeKey(key),
    bytes: await blob.arrayBuffer(),
    type: blob.type,
    size: blob.size,
  };
}

export function createIdbBlobStore(): BlobStore {
  return {
    name: "idb",
    async write(key, blob) {
      await (await getBlobDb()).put("blobs", await toRecord(key, blob));
    },
    async read(key) {
      const db = await getBlobDb();
      const entry = await db.get("blobs", sanitizeKey(key));
      if (entry) {
        return new Blob([entry.bytes], { type: entry.type });
      }
      const records = await getChunkRecords(db, key);
      if (records.length === 0) return undefined;
      const parts = records.map((record) => record.bytes);
      return new Blob(parts, { type: "" });
    },
    async delete(key) {
      const db = await getBlobDb();
      await db.delete("blobs", sanitizeKey(key));
      const records = await getChunkRecords(db, key);
      await Promise.all(records.map((record) => db.delete("chunks", record.key)));
    },
    async size(key) {
      const db = await getBlobDb();
      const entry = await db.get("blobs", sanitizeKey(key));
      if (entry) return entry.size;
      const records = await getChunkRecords(db, key);
      if (records.length === 0) return undefined;
      return records.reduce((sum, record) => sum + record.size, 0);
    },
    async createWriter(key, mode) {
      const db = await getBlobDb();
      const safeKey = sanitizeKey(key);
      let index = 0;
      if (mode === "append") {
        const records = await getChunkRecords(db, key);
        if (records.length > 0) {
          index = records[records.length - 1].index + 1;
        }
      } else {
        const records = await getChunkRecords(db, key);
        await Promise.all(records.map((record) => db.delete("chunks", record.key)));
      }
      return {
        async write(blob) {
          await db.put("chunks", {
            key: chunkKey(safeKey, index),
            videoKey: safeKey,
            index,
            bytes: await blob.arrayBuffer(),
            size: blob.size,
          });
          index += 1;
        },
        async close() {
          // Chunks are persisted per write; nothing to flush.
        },
        async abort() {
          // Keep chunks written so far; callers delete on cancel.
        },
      };
    },
    async consolidate(key) {
      const db = await getBlobDb();
      const records = await getChunkRecords(db, key);
      if (records.length === 0) return;
      const blob = new Blob(records.map((record) => record.bytes));
      await db.put("blobs", {
        key: sanitizeKey(key),
        bytes: await blob.arrayBuffer(),
        type: "",
        size: blob.size,
      });
      await Promise.all(records.map((record) => db.delete("chunks", record.key)));
    },
  };
}

export function getBlobStore(): BlobStore {
  if (isOpfsSupported()) {
    return createOpfsStore();
  }
  if (isCacheStoreSupported()) {
    return createCacheStore();
  }
  return createIdbBlobStore();
}

export function getDownloadBlobStore(): BlobStore {
  if (isOpfsSupported()) {
    return createOpfsStore();
  }
  return createIdbBlobStore();
}
