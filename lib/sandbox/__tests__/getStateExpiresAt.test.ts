import { describe, it, expect } from "vitest";
import { getStateExpiresAt } from "@/lib/sandbox/getStateExpiresAt";

describe("getStateExpiresAt", () => {
  it("returns the numeric expiresAt when present", () => {
    expect(getStateExpiresAt({ type: "vercel", expiresAt: 4_102_444_800_000 })).toBe(
      4_102_444_800_000,
    );
  });

  it("returns undefined when expiresAt is not a number", () => {
    expect(getStateExpiresAt({ type: "vercel", expiresAt: "soon" })).toBeUndefined();
    expect(getStateExpiresAt({ type: "vercel" })).toBeUndefined();
  });

  it("returns undefined for null / undefined / non-object inputs", () => {
    expect(getStateExpiresAt(null)).toBeUndefined();
    expect(getStateExpiresAt(undefined)).toBeUndefined();
    expect(getStateExpiresAt("nope")).toBeUndefined();
    expect(getStateExpiresAt(42)).toBeUndefined();
  });
});
