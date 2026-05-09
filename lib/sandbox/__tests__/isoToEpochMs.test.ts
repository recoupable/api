import { describe, it, expect } from "vitest";
import { isoToEpochMs } from "@/lib/sandbox/isoToEpochMs";

describe("isoToEpochMs", () => {
  it("returns null for null input", () => {
    expect(isoToEpochMs(null)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(isoToEpochMs("")).toBeNull();
  });

  it("returns null for an unparseable string", () => {
    expect(isoToEpochMs("not-a-date")).toBeNull();
  });

  it("converts a valid ISO string to epoch milliseconds", () => {
    expect(isoToEpochMs("2030-01-01T00:00:00.000Z")).toBe(Date.parse("2030-01-01T00:00:00.000Z"));
  });
});
