import { beforeEach, describe, expect, it } from "vitest";

import {
  clearLibrary,
  countVideos,
  deleteProgress,
  deleteVideo,
  getProgress,
  getVideo,
  listVideos,
  listVideosByStatus,
  putProgress,
  putVideo,
  updateVideo,
} from "@/lib/storage/metadata-db";
import type { Video } from "@/types/video";

function makeVideo(id: string, overrides: Partial<Video> = {}): Video {
  return {
    id,
    title: `Video ${id}`,
    tags: [],
    sourceKind: "local-file",
    createdAt: 1_000,
    status: "not-downloaded",
    ...overrides,
  };
}

beforeEach(async () => {
  await clearLibrary();
});

describe("videos store", () => {
  it("round-trips a video record", async () => {
    const video = makeVideo("v1", {
      title: "Lecture 01",
      durationSec: 5400,
      sizeBytes: 1024,
    });

    await putVideo(video);
    const stored = await getVideo("v1");

    expect(stored).toEqual(video);
  });

  it("updates an existing video with a patch", async () => {
    await putVideo(makeVideo("v1"));
    await updateVideo("v1", { status: "complete", sizeBytes: 2048 });

    const stored = await getVideo("v1");
    expect(stored?.status).toBe("complete");
    expect(stored?.sizeBytes).toBe(2048);
    expect(stored?.title).toBe("Video v1");
  });

  it("ignores updates for missing videos", async () => {
    await expect(updateVideo("missing", { title: "Nope" })).resolves.toBe(
      undefined,
    );
    expect(await getVideo("missing")).toBeUndefined();
  });

  it("lists videos newest-first", async () => {
    await putVideo(makeVideo("old", { createdAt: 1_000 }));
    await putVideo(makeVideo("new", { createdAt: 3_000 }));
    await putVideo(makeVideo("mid", { createdAt: 2_000 }));

    const videos = await listVideos();
    expect(videos.map((v) => v.id)).toEqual(["new", "mid", "old"]);
  });

  it("filters videos by download status", async () => {
    await putVideo(makeVideo("a", { status: "complete" }));
    await putVideo(makeVideo("b", { status: "downloading" }));
    await putVideo(makeVideo("c", { status: "complete" }));

    const complete = await listVideosByStatus("complete");
    expect(complete.map((v) => v.id).sort()).toEqual(["a", "c"]);
  });

  it("counts videos", async () => {
    expect(await countVideos()).toBe(0);
    await putVideo(makeVideo("a"));
    await putVideo(makeVideo("b"));
    expect(await countVideos()).toBe(2);
  });

  it("deletes a video and its progress together", async () => {
    await putVideo(makeVideo("v1"));
    await putProgress({ videoId: "v1", positionSec: 120, updatedAt: 1_000 });

    await deleteVideo("v1");

    expect(await getVideo("v1")).toBeUndefined();
    expect(await getProgress("v1")).toBeUndefined();
  });
});

describe("progress store", () => {
  it("round-trips watch progress", async () => {
    const progress = { videoId: "v1", positionSec: 420, updatedAt: 5_000 };
    await putProgress(progress);
    expect(await getProgress("v1")).toEqual(progress);
  });

  it("overwrites progress for the same video", async () => {
    await putProgress({ videoId: "v1", positionSec: 100, updatedAt: 1_000 });
    await putProgress({ videoId: "v1", positionSec: 900, updatedAt: 2_000 });

    const stored = await getProgress("v1");
    expect(stored?.positionSec).toBe(900);
  });

  it("deletes progress", async () => {
    await putProgress({ videoId: "v1", positionSec: 10, updatedAt: 1_000 });
    await deleteProgress("v1");
    expect(await getProgress("v1")).toBeUndefined();
  });
});
