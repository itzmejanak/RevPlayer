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
    file: FakeFileHandle;
    position = 0;

    constructor(file: FakeFileHandle, keepExisting: boolean) {
      this.file = file;
      if (keepExisting) {
        this.position = file.bytes.byteLength;
      } else {
        file.bytes = new Uint8Array();
      }
    }

    async write(chunk: Blob) {
      const incoming = new Uint8Array(await chunk.arrayBuffer());
      const next = new Uint8Array(this.file.bytes.byteLength + incoming.byteLength);
      next.set(this.file.bytes);
      next.set(incoming, this.file.bytes.byteLength);
      this.file.bytes = next;
    }

    async seek(offset: number) {
      this.position = offset;
    }

    async close() {}

    async abort() {}
  }

  class FakeFileHandle {
    bytes = new Uint8Array();

    async createWritable(options?: { keepExistingData?: boolean }) {
      return new FakeWritable(this, options?.keepExistingData === true);
    }

    async getFile(): Promise<File> {
      return new File([this.bytes], "file");
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

  it("appends chunks through the incremental writer", async () => {
    const store = createOpfsStore();
    const writer = await store.createWriter!("clip", "truncate");
    await writer.write(new Blob([new Uint8Array([0, 1, 2])]));
    await writer.write(new Blob([new Uint8Array([3, 4])]));
    await writer.close();

    expect(await store.size("clip")).toBe(5);
    const read = await store.read("clip");
    expect(new Uint8Array(await read!.arrayBuffer())).toEqual(
      new Uint8Array([0, 1, 2, 3, 4]),
    );
  });

  it("resumes an append-mode writer after the existing data", async () => {
    const store = createOpfsStore();
    const first = await store.createWriter!("clip", "truncate");
    await first.write(new Blob([new Uint8Array([0, 1, 2])]));
    await first.close();

    const second = await store.createWriter!("clip", "append");
    await second.write(new Blob([new Uint8Array([3, 4])]));
    await second.close();

    expect(await store.size("clip")).toBe(5);
    const read = await store.read("clip");
    expect(new Uint8Array(await read!.arrayBuffer())).toEqual(
      new Uint8Array([0, 1, 2, 3, 4]),
    );
  });
});

describe("IDB incremental writer", () => {
  it("writes chunks and reads them back in order", async () => {
    const store = createIdbBlobStore();
    const writer = await store.createWriter!("clip", "truncate");
    await writer.write(new Blob(["hello "], { type: "video/mp4" }));
    await writer.write(new Blob(["world"]));
    await writer.close();

    expect(await store.size("clip")).toBe(11);
    const read = await store.read("clip");
    expect(await read?.text()).toBe("hello world");
  });

  it("resumes appending after existing chunks", async () => {
    const store = createIdbBlobStore();
    const first = await store.createWriter!("clip", "truncate");
    await first.write(new Blob(["abc"]));
    await first.close();

    const second = await store.createWriter!("clip", "append");
    await second.write(new Blob(["def"]));
    await second.close();

    expect(await store.read("clip")).toBeDefined();
    expect(await (await store.read("clip"))!.text()).toBe("abcdef");
  });

  it("consolidates chunks into a single whole-blob record", async () => {
    const store = createIdbBlobStore();
    const writer = await store.createWriter!("clip", "truncate");
    await writer.write(new Blob(["chunk one "]));
    await writer.write(new Blob(["chunk two"]));
    await writer.close();

    expect(await store.size("clip")).toBe(19);
    await store.consolidate!("clip");
    expect(await store.size("clip")).toBe(19);
    expect(await (await store.read("clip"))!.text()).toBe(
      "chunk one chunk two",
    );
  });

  it("delete removes both whole-blob records and chunks", async () => {
    const store = createIdbBlobStore();
    const writer = await store.createWriter!("clip", "truncate");
    await writer.write(new Blob(["data"]));
    await writer.close();

    await store.delete("clip");
    expect(await store.read("clip")).toBeUndefined();
    expect(await store.size("clip")).toBeUndefined();
  });
});
