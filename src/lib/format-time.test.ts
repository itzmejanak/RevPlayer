import { describe, expect, it } from "vitest";

import { formatTime } from "./format-time";

describe("formatTime", () => {
  it("formats sub-minute times", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(7)).toBe("0:07");
    expect(formatTime(59)).toBe("0:59");
  });

  it("formats minute times", () => {
    expect(formatTime(60)).toBe("1:00");
    expect(formatTime(605)).toBe("10:05");
  });

  it("formats hour times", () => {
    expect(formatTime(3600)).toBe("1:00:00");
    expect(formatTime(7325)).toBe("2:02:05");
  });

  it("rounds down and handles invalid input", () => {
    expect(formatTime(90.9)).toBe("1:30");
    expect(formatTime(-5)).toBe("0:00");
    expect(formatTime(Number.NaN)).toBe("0:00");
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe("0:00");
  });
});
