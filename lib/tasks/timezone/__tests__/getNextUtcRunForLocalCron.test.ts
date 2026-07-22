import { describe, it, expect } from "vitest";
import { getNextUtcRunForLocalCron } from "../getNextUtcRunForLocalCron";

const iso = (d: Date) => d.toISOString();

describe("getNextUtcRunForLocalCron", () => {
  describe("weekly 9am local (the weekly-report case)", () => {
    it("lands 9am New York on a winter (EST, UTC-5) Monday", () => {
      // Monday 2026-01-05 00:00Z, before that day's 09:00 EST (= 14:00Z)
      const from = new Date("2026-01-05T00:00:00Z");
      const next = getNextUtcRunForLocalCron("0 9 * * 1", "America/New_York", from);
      expect(iso(next)).toBe("2026-01-05T14:00:00.000Z");
    });

    it("lands 9am New York on a summer (EDT, UTC-4) Monday", () => {
      // Monday 2026-07-06 00:00Z, before that day's 09:00 EDT (= 13:00Z)
      const from = new Date("2026-07-06T00:00:00Z");
      const next = getNextUtcRunForLocalCron("0 9 * * 1", "America/New_York", from);
      expect(iso(next)).toBe("2026-07-06T13:00:00.000Z");
    });

    it("rolls to next Monday when this week's local 9am already passed", () => {
      // Monday 2026-01-05 15:00Z is after 14:00Z (09:00 EST); next is Jan 12
      const from = new Date("2026-01-05T15:00:00Z");
      const next = getNextUtcRunForLocalCron("0 9 * * 1", "America/New_York", from);
      expect(iso(next)).toBe("2026-01-12T14:00:00.000Z");
    });

    it("interprets the cron in UTC when the timezone is UTC", () => {
      const from = new Date("2026-01-05T00:00:00Z");
      const next = getNextUtcRunForLocalCron("0 9 * * 1", "UTC", from);
      expect(iso(next)).toBe("2026-01-05T09:00:00.000Z");
    });

    it("lands 9am Tokyo (UTC+9) Monday", () => {
      // 09:00 JST Monday 2026-01-05 = 00:00Z same day
      const from = new Date("2026-01-04T00:00:00Z");
      const next = getNextUtcRunForLocalCron("0 9 * * 1", "Asia/Tokyo", from);
      expect(iso(next)).toBe("2026-01-05T00:00:00.000Z");
    });
  });

  describe("daily wildcard day-of-week", () => {
    it("finds the next 09:30 local on any day", () => {
      const from = new Date("2026-03-10T20:00:00Z"); // EDT, 16:00 local
      const next = getNextUtcRunForLocalCron("30 9 * * *", "America/New_York", from);
      // next 09:30 EDT is 2026-03-11 → 13:30Z
      expect(iso(next)).toBe("2026-03-11T13:30:00.000Z");
    });
  });

  describe("validation", () => {
    it("throws on an invalid timezone", () => {
      expect(() => getNextUtcRunForLocalCron("0 9 * * 1", "Not/AZone", new Date())).toThrow();
    });

    it("throws on a non 5-field cron", () => {
      expect(() => getNextUtcRunForLocalCron("0 9 * *", "UTC", new Date())).toThrow();
    });

    it("throws on non-numeric minute or hour", () => {
      expect(() => getNextUtcRunForLocalCron("*/5 9 * * 1", "UTC", new Date())).toThrow();
    });
  });
});
