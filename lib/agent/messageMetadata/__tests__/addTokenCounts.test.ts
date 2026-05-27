import { describe, it, expect } from "vitest";
import { addTokenCounts } from "@/lib/agent/messageMetadata/addTokenCounts";

describe("addTokenCounts", () => {
  it("returns undefined when both inputs are undefined", () => {
    expect(addTokenCounts(undefined, undefined)).toBeUndefined();
  });

  it("returns undefined when both inputs are null", () => {
    expect(addTokenCounts(null as never, null as never)).toBeUndefined();
  });

  it("sums two numbers", () => {
    expect(addTokenCounts(100, 50)).toBe(150);
  });

  it("treats undefined on one side as 0", () => {
    expect(addTokenCounts(100, undefined)).toBe(100);
    expect(addTokenCounts(undefined, 50)).toBe(50);
  });

  it("handles zero correctly (not confused with undefined)", () => {
    expect(addTokenCounts(0, 50)).toBe(50);
    expect(addTokenCounts(0, 0)).toBe(0);
    expect(addTokenCounts(0, undefined)).toBe(0);
  });
});
