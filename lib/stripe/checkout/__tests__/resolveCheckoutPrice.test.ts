import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/stripe/config", () => ({
  STRIPE_SUBSCRIPTION_PRICE_ID: "price_pro",
  STRIPE_SUBSCRIPTION_TRIAL_PERIOD_DAYS: 30,
  STRIPE_STARTER_PRICE_ID: "",
}));

const { resolveCheckoutPrice } = await import("../resolveCheckoutPrice");

describe("resolveCheckoutPrice", () => {
  it("maps pro to the Pro price with the 30-day trial", () => {
    expect(resolveCheckoutPrice("pro")).toEqual({ price: "price_pro", trialPeriodDays: 30 });
  });

  it("returns null for starter while STRIPE_STARTER_PRICE_ID is unset", () => {
    expect(resolveCheckoutPrice("starter")).toBeNull();
  });
});
