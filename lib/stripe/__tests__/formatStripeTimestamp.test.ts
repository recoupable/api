import { describe, it, expect } from "vitest";
import { formatStripeTimestamp } from "@/lib/stripe/formatStripeTimestamp";

describe("formatStripeTimestamp", () => {
  it("formats a unix-seconds timestamp as an ISO date", () => {
    expect(formatStripeTimestamp(1783415103)).toBe("2026-07-07");
  });
});
