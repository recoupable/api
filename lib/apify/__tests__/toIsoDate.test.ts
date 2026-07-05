import { describe, it, expect } from "vitest";

import { toIsoDate } from "../toIsoDate";

describe("toIsoDate", () => {
  it("converts Twitter's legacy date format to ISO", () => {
    expect(toIsoDate("Thu Jul 02 17:21:21 +0000 2026")).toBe("2026-07-02T17:21:21.000Z");
  });

  it("normalizes an already-ISO string", () => {
    expect(toIsoDate("2025-06-15T19:18:17.000Z")).toBe("2025-06-15T19:18:17.000Z");
  });

  it("returns undefined for an unparseable value", () => {
    expect(toIsoDate("not-a-date")).toBeUndefined();
  });

  it("returns undefined for empty/absent values", () => {
    expect(toIsoDate("")).toBeUndefined();
    expect(toIsoDate(undefined)).toBeUndefined();
  });
});
