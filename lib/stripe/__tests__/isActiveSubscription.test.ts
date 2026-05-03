import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { isActiveSubscription } from "@/lib/stripe/isActiveSubscription";

function sub(
  partial: Partial<Stripe.Subscription> & { status: Stripe.Subscription.Status },
): Stripe.Subscription {
  return partial as Stripe.Subscription;
}

describe("isActiveSubscription", () => {
  it("returns false for null/undefined", () => {
    expect(isActiveSubscription(null)).toBe(false);
    expect(isActiveSubscription(undefined)).toBe(false);
  });

  it("returns true for active", () => {
    expect(isActiveSubscription(sub({ status: "active" }))).toBe(true);
  });

  it("returns true for trialing without canceled_at", () => {
    expect(isActiveSubscription(sub({ status: "trialing", canceled_at: null }))).toBe(true);
  });

  it("returns false for trialing with canceled_at", () => {
    expect(isActiveSubscription(sub({ status: "trialing", canceled_at: 1 }))).toBe(false);
  });

  it("returns false for non-billable statuses", () => {
    for (const status of [
      "canceled",
      "incomplete",
      "incomplete_expired",
      "past_due",
      "unpaid",
      "paused",
    ] as const) {
      expect(isActiveSubscription(sub({ status }))).toBe(false);
    }
  });
});
