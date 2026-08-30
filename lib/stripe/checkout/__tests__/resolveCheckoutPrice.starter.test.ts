import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/stripe/config", () => ({
  STRIPE_SUBSCRIPTION_PRICE_ID: "price_pro",
  STRIPE_SUBSCRIPTION_TRIAL_PERIOD_DAYS: 30,
  STRIPE_STARTER_PRICE_ID: "price_starter",
}));

const { resolveCheckoutPrice } = await import("../resolveCheckoutPrice");
const { resolvePlanFromPriceId } = await import("../resolvePlanFromPriceId");

describe("resolveCheckoutPrice with Starter configured", () => {
  it("maps starter to the Starter price with no trial", () => {
    expect(resolveCheckoutPrice("starter")).toEqual({ price: "price_starter" });
  });

  it("resolves the plan back from a price id", () => {
    expect(resolvePlanFromPriceId("price_starter")).toBe("starter");
    expect(resolvePlanFromPriceId("price_pro")).toBe("pro");
    expect(resolvePlanFromPriceId(undefined)).toBe("pro");
  });
});
