import { describe, expect, it } from "vitest";
import { getMinCadenceMinutes } from "@/lib/plans/getMinCadenceMinutes";

describe("getMinCadenceMinutes", () => {
  it("every minute is 1", () => {
    expect(getMinCadenceMinutes("* * * * *")).toBe(1);
  });

  it("hourly is 60, every 15 minutes is 15", () => {
    expect(getMinCadenceMinutes("0 * * * *")).toBe(60);
    expect(getMinCadenceMinutes("*/15 * * * *")).toBe(15);
  });

  it("daily is 1440, twice a day is 720 apart at the closest", () => {
    expect(getMinCadenceMinutes("0 9 * * *")).toBe(1440);
    expect(getMinCadenceMinutes("0 9,21 * * *")).toBe(720);
  });

  it("weekly is 10080; weekdays is 1440", () => {
    expect(getMinCadenceMinutes("0 13 * * 1")).toBe(10080);
    expect(getMinCadenceMinutes("30 8 * * 1-5")).toBe(1440);
  });

  it("monthly and yearly crons exceed weekly", () => {
    expect(getMinCadenceMinutes("0 0 1 * *")).toBeGreaterThan(10080);
    expect(getMinCadenceMinutes("0 0 1 1 *")).toBeGreaterThan(10080);
  });

  it("returns null for an unparseable expression", () => {
    expect(getMinCadenceMinutes("not a cron")).toBeNull();
    expect(getMinCadenceMinutes("0 25 * * *")).toBeNull();
  });
});
