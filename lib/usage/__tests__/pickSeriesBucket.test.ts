import { describe, it, expect } from "vitest";
import { pickSeriesBucket } from "@/lib/usage/pickSeriesBucket";

const from = "2026-08-01T00:00:00.000Z";
const plus = (days: number) => new Date(Date.UTC(2026, 7, 1) + days * 86_400_000).toISOString();

describe("pickSeriesBucket", () => {
  it("uses hours up to two days", () => {
    expect(pickSeriesBucket(from, plus(1))).toBe("hour");
    expect(pickSeriesBucket(from, plus(2))).toBe("hour");
  });

  it("uses days up to 90 days", () => {
    expect(pickSeriesBucket(from, plus(2.01))).toBe("day");
    expect(pickSeriesBucket(from, plus(30))).toBe("day");
    expect(pickSeriesBucket(from, plus(90))).toBe("day");
  });

  it("uses weeks up to twelve months", () => {
    expect(pickSeriesBucket(from, plus(91))).toBe("week");
    expect(pickSeriesBucket(from, plus(366))).toBe("week");
  });

  it("uses months beyond that", () => {
    expect(pickSeriesBucket(from, plus(367))).toBe("month");
    expect(pickSeriesBucket(from, plus(730))).toBe("month");
  });
});
