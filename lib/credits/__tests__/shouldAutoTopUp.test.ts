import { describe, it, expect } from "vitest";
import { shouldAutoTopUp } from "@/lib/credits/shouldAutoTopUp";

const NOW = new Date("2026-09-04T15:00:00Z");
const base = {
  enabled: true,
  amountCredits: 100_000_000,
  thresholdCredits: 1_000_000,
  lastRunAt: null as string | null,
  remainingCredits: 500_000,
  now: NOW,
};

describe("shouldAutoTopUp", () => {
  it("is true when enabled, configured, below threshold, and no recent run", () => {
    expect(shouldAutoTopUp(base)).toBe(true);
  });

  it("is false when disabled", () => {
    expect(shouldAutoTopUp({ ...base, enabled: false })).toBe(false);
  });

  it("is false when amount or threshold is unset", () => {
    expect(shouldAutoTopUp({ ...base, amountCredits: null })).toBe(false);
    expect(shouldAutoTopUp({ ...base, thresholdCredits: null })).toBe(false);
  });

  it("is false when the balance is at or above the threshold", () => {
    expect(shouldAutoTopUp({ ...base, remainingCredits: 1_000_000 })).toBe(false);
    expect(shouldAutoTopUp({ ...base, remainingCredits: 2_000_000 })).toBe(false);
  });

  it("is false when the last run was inside the 10-minute window", () => {
    expect(shouldAutoTopUp({ ...base, lastRunAt: "2026-09-04T14:51:00Z" })).toBe(false);
  });

  it("fails closed for a malformed or empty lastRunAt", () => {
    expect(shouldAutoTopUp({ ...base, lastRunAt: "not-a-date" })).toBe(false);
    expect(shouldAutoTopUp({ ...base, lastRunAt: "" })).toBe(false);
  });

  it("is true when the last run was more than 10 minutes ago", () => {
    expect(shouldAutoTopUp({ ...base, lastRunAt: "2026-09-04T14:49:59Z" })).toBe(true);
  });
});
