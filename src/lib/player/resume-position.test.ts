import { describe, expect, it } from "vitest";

import {
  MIN_RESUME_SECONDS,
  MIN_SAVE_INTERVAL_MS,
  computeResumePosition,
  shouldSaveProgress,
} from "./resume-position";

describe("computeResumePosition", () => {
  it("returns 0 for missing or early positions", () => {
    expect(computeResumePosition(undefined, 600)).toBe(0);
    expect(computeResumePosition(0, 600)).toBe(0);
    expect(computeResumePosition(MIN_RESUME_SECONDS - 1, 600)).toBe(0);
  });

  it("returns the position for mid-video positions", () => {
    expect(computeResumePosition(42, 600)).toBe(42);
  });

  it("clamps to just before the end threshold", () => {
    expect(computeResumePosition(580, 600)).toBe(580);
  });

  it("treats a position beyond the duration as finished", () => {
    expect(computeResumePosition(999, 600)).toBe(0);
  });

  it("returns 0 when the video was watched to the end", () => {
    expect(computeResumePosition(599, 600)).toBe(0);
    expect(computeResumePosition(600, 600)).toBe(0);
  });

  it("returns the position when duration is unknown", () => {
    expect(computeResumePosition(42, 0)).toBe(42);
  });
});

describe("shouldSaveProgress", () => {
  it("skips writes before the minimum position", () => {
    expect(shouldSaveProgress(3, 1_000, null)).toBe(false);
  });

  it("saves when no previous save exists", () => {
    expect(shouldSaveProgress(30, 1_000, null)).toBe(true);
  });

  it("saves only after the interval elapses", () => {
    expect(shouldSaveProgress(30, 1_000, 500, MIN_SAVE_INTERVAL_MS)).toBe(false);
    expect(
      shouldSaveProgress(30, 1_000 + MIN_SAVE_INTERVAL_MS, 1_000, MIN_SAVE_INTERVAL_MS),
    ).toBe(true);
  });
});
