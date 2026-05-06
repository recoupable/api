import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import isActiveSubscription from "@/lib/stripe/isActiveSubscription";

function sub(
  partial: Pick<Stripe.Subscription, "status"> & Partial<Stripe.Subscription>,
): Stripe.Subscription {
  return partial as Stripe.Subscription;
}

describe("isActiveSubscription", () => {
  it("returns false for null/undefined", () => {
    expect(isActiveSubscription(null)).toBe(false);
    expect(isActiveSubscription(undefined)).toBe(false);
  });

  it("returns true for status active", () => {
    expect(isActiveSubscription(sub({ status: "active" }))).toBe(true);
  });

  it("returns true for trialing without canceled_at", () => {
    expect(isActiveSubscription(sub({ status: "trialing", canceled_at: null }))).toBe(true);
  });

  it("returns false for trialing with canceled_at (canceled trial)", () => {
    expect(isActiveSubscription(sub({ status: "trialing", canceled_at: 1234567890 }))).toBe(false);
  });

  it("returns false for canceled and other non-entitled statuses", () => {
    expect(isActiveSubscription(sub({ status: "canceled" }))).toBe(false);
    expect(isActiveSubscription(sub({ status: "unpaid" }))).toBe(false);
    expect(isActiveSubscription(sub({ status: "past_due" }))).toBe(false);
    expect(isActiveSubscription(sub({ status: "incomplete" }))).toBe(false);
    expect(isActiveSubscription(sub({ status: "incomplete_expired" }))).toBe(false);
  });
});
