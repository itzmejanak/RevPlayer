import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  OPFS_DIR,
  createIdbBlobStore,
  createOpfsStore,
  getBlobStore,
  isCacheStoreSupported,
  isOpfsSupported,
  sanitizeKey,
} from "@/lib/storage/opfs";

describe("sanitizeKey", () => {
  it("replaces unsafe characters with underscores", () => {
    expect(sanitizeKey("my video!@#.mp4")).toBe("my_video_.mp4");
  });

  it("collapses dot segments and trims leading/trailing dots", () => {
    expect(sanitizeKey("..file...name..")).toBe("file.name");
  });

  it("falls back for an empty result", () => {
    expect(sanitizeKey("///")).toBe("file");
  });
});

describe("feature detection in jsdom", () => {
  it("reports OPFS unsupported when storage.getDirectory is missing", () => {
    expect(isOpfsSupported()).toBe(false);
  });

  it("reports Cache API unsupported when caches is missing", () => {
    expect(isCacheStoreSupported()).toBe(false);
  });

  it("selects the IndexedDB fallback store", () => {
    expect(getBlobStore().name).toBe("idb");
  });
});

describe("IndexedDB blob store fallback", () => {
  it("round-trips blobs", async () => {
    const store = createIdbBlobStore();
    const blob = new Blob(["hello world"], { type: "video/mp4" });

    expect(await store.size("clip-1")).toBeUndefined();

    await store.write("clip-1", blob);
    expect(await store.size("clip-1")).toBe(11);

    const read = await store.read("clip-1");
    expect(read?.type).toBe("video/mp4");
    expect(await read?.text()).toBe("hello world");

    await store.delete("clip-1");
    expect(await store.read("clip-1")).toBeUndefined();
  });
});

describe("OPFS store against a mocked directory handle", () => {
  let storage: {
    getDirectory: ReturnType<typeof vi.fn>;
  };
  let root: FakeDirHandle;

  class FakeWritable {
    chunks: ArrayBuffer[] = [];

    async write(chunk: Blob) {
      this.chunks.push(await chunk.arrayBuffer());
    }

    async close() {}
  }

  class FakeFileHandle {
    writable = new FakeWritable();

    async createWritable() {
      this.writable = new FakeWritable();
      return this.writable;
    }

    async getFile(): Promise<File> {
      return new File(this.writable.chunks, "file");
    }
  }

  class FakeDirHandle {
    files = new Map<string, FakeFileHandle>();
    dirs = new Map<string, FakeDirHandle>();

    async getDirectoryHandle(
      name: string,
      options?: { create?: boolean },
    ): Promise<FakeDirHandle> {
      if (!this.dirs.has(name)) {
        if (!options?.create) {
          throw new Error("NotFoundError");
        }
        this.dirs.set(name, new FakeDirHandle());
      }
      return this.dirs.get(name)!;
    }

    async getFileHandle(name: string, options?: { create?: boolean }) {
      if (!this.files.has(name)) {
        if (!options?.create) {
          throw new Error("NotFoundError");
        }
        this.files.set(name, new FakeFileHandle());
      }
      return this.files.get(name)!;
    }

    async removeEntry(name: string) {
      this.files.delete(name);
    }
  }

  beforeEach(() => {
    root = new FakeDirHandle();
    storage = {
      getDirectory: vi.fn(async () => root),
    };
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: storage,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "storage", { value: undefined });
    vi.restoreAllMocks();
  });

  it("writes and reads a blob through the nested videos directory", async () => {
    const store = createOpfsStore();
    const blob = new Blob([new Uint8Array([0, 1, 2, 3])], { type: "video/mp4" });

    await store.write("clip", blob);

    expect(storage.getDirectory).toHaveBeenCalled();
    expect(root.dirs.get(OPFS_DIR)?.files.has("clip")).toBe(true);

    const read = await store.read("clip");
    expect(new Uint8Array(await read!.arrayBuffer())).toEqual(
      new Uint8Array([0, 1, 2, 3]),
    );
  });

  it("reports a stored blob's size", async () => {
    const store = createOpfsStore();
    await store.write("clip", new Blob([new Uint8Array(10)]));

    expect(await store.size("clip")).toBe(10);
    expect(await store.size("missing")).toBeUndefined();
  });

  it("deletes blobs and reports missing entries as undefined", async () => {
    const store = createOpfsStore();
    await store.write("clip", new Blob(["x"]));
    await store.delete("clip");

    expect(await store.read("clip")).toBeUndefined();
    expect(await store.size("clip")).toBeUndefined();
  });
});
