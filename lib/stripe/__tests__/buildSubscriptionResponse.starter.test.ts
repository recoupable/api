import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/stripe/config", () => ({ STRIPE_STARTER_PRICE_ID: "price_starter" }));

const { buildSubscriptionResponse } = await import("@/lib/stripe/buildSubscriptionResponse");

describe("buildSubscriptionResponse starter", () => {
  it("reports plan starter and isPro false for the Starter price", () => {
    const account = {
      status: "active",
      canceled_at: null,
      items: { data: [{ price: { id: "price_starter" } }] },
    } as never;
    expect(buildSubscriptionResponse({ account, organization: null })).toEqual({
      isPro: false,
      status: "active",
      plan: "starter",
      source: "account",
    });
  });
});
