import { describe, expect, it } from "vitest";
import { getCalendarMonthStart } from "@/lib/plans/getCalendarMonthStart";

describe("getCalendarMonthStart", () => {
  it("returns the first instant of the current UTC month as an ISO string", () => {
    expect(getCalendarMonthStart(new Date("2026-09-07T20:05:13.000Z"))).toBe(
      "2026-09-01T00:00:00.000Z",
    );
  });

  it("uses the UTC month, not the local one, on the boundary", () => {
    expect(getCalendarMonthStart(new Date("2026-10-01T00:00:00.000Z"))).toBe(
      "2026-10-01T00:00:00.000Z",
    );
    expect(getCalendarMonthStart(new Date("2026-09-30T23:59:59.999Z"))).toBe(
      "2026-09-01T00:00:00.000Z",
    );
  });
});
