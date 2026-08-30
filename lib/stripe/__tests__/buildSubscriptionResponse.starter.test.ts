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

  it("reports organization Pro when a Starter account also has an active org Pro sub", () => {
    const account = {
      status: "active",
      canceled_at: null,
      items: { data: [{ price: { id: "price_starter" } }] },
    } as never;
    const organization = {
      status: "active",
      canceled_at: null,
      items: { data: [{ price: { id: "price_pro" } }] },
    } as never;
    expect(buildSubscriptionResponse({ account, organization })).toEqual({
      isPro: true,
      status: "active",
      plan: "pro",
      source: "organization",
    });
  });
});
