import { describe, it, expect } from "vitest";
import { describeCronCadence } from "../describeCronCadence";

describe("describeCronCadence", () => {
  it("names a weekly schedule by weekday and time", () => {
    expect(describeCronCadence("0 13 * * 1")).toBe("Mondays at 13:00 UTC");
    expect(describeCronCadence("30 9 * * 0")).toBe("Sundays at 09:30 UTC");
  });

  it("honours an explicit time zone instead of claiming UTC", () => {
    expect(describeCronCadence("0 13 * * 1", "America/New_York")).toBe(
      "Mondays at 13:00 America/New_York",
    );
  });

  it("names a daily schedule", () => {
    expect(describeCronCadence("0 8 * * *")).toBe("every day at 08:00 UTC");
  });

  it("falls back to the raw expression rather than inventing a cadence", () => {
    // Better an honest cron string than a confident wrong sentence in an email.
    expect(describeCronCadence("*/5 * * * *")).toBe("the schedule */5 * * * *");
    expect(describeCronCadence("not a cron")).toBe("the schedule not a cron");
  });
});
