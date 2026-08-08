import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export const OPFS_DIR = "revplayer-videos";

export interface BlobStore {
  name: "opfs" | "cache" | "idb";
  write(key: string, blob: Blob): Promise<void>;
  read(key: string): Promise<Blob | undefined>;
  delete(key: string): Promise<void>;
  size(key: string): Promise<number | undefined>;
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
}

const BLOB_DB_NAME = "revplayer-blobs";
const BLOB_DB_VERSION = 1;

let blobDbPromise: Promise<IDBPDatabase<BlobDBSchema>> | null = null;

function getBlobDb(): Promise<IDBPDatabase<BlobDBSchema>> {
  if (!blobDbPromise) {
    blobDbPromise = openDB<BlobDBSchema>(BLOB_DB_NAME, BLOB_DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("blobs", { keyPath: "key" });
      },
    });
  }
  return blobDbPromise;
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
      const entry = await (await getBlobDb()).get("blobs", sanitizeKey(key));
      return entry
        ? new Blob([entry.bytes], { type: entry.type })
        : undefined;
    },
    async delete(key) {
      await (await getBlobDb()).delete("blobs", sanitizeKey(key));
    },
    async size(key) {
      const entry = await (await getBlobDb()).get("blobs", sanitizeKey(key));
      return entry?.size;
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
