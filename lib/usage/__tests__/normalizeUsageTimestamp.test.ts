import { describe, expect, it } from "vitest";
import { normalizeUsageTimestamp } from "../normalizeUsageTimestamp";

describe("database timestamp normalization", () => {
  it.each([
    ["2026-08-27T13:56:58.123456+02:00", "2026-08-27T11:56:58.123456Z"],
    ["2026-08-27T11:56:58Z", "2026-08-27T11:56:58.000000Z"],
    ["2026-08-27T11:56:58.1Z", "2026-08-27T11:56:58.100000Z"],
    ["2026-08-27T11:56:58.1234564Z", "2026-08-27T11:56:58.123456Z"],
    ["2026-08-27T23:59:59.9999995Z", "2026-08-28T00:00:00.000000Z"],
  ])("normalizes %s at database microsecond precision", (input, expected) => {
    expect(normalizeUsageTimestamp(input)).toBe(expected);
  });
});
