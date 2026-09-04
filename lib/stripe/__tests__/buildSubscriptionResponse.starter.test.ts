import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/stripe/config", () => ({ STRIPE_STARTER_PRICE_ID: "price_starter" }));

const { buildSubscriptionResponse } = await import("@/lib/stripe/buildSubscriptionResponse");

describe("buildSubscriptionResponse starter", () => {
  it("reports plan starter and isPro false for the Starter price", () => {
    const account = {
      status: "active",
      canceled_at: null,
      collection_method: "charge_automatically",
      current_period_end: 1790380800,
      items: {
        data: [
          {
            price: {
              id: "price_starter",
              nickname: "Starter",
              unit_amount: 2900,
              currency: "usd",
              recurring: { interval: "month" },
            },
          },
        ],
      },
    } as never;
    expect(buildSubscriptionResponse({ account, organization: null })).toEqual({
      isPro: false,
      status: "active",
      plan: "starter",
      source: "account",
      name: "Starter",
      amountCents: 2900,
      currency: "usd",
      interval: "month",
      collectionMethod: "charge_automatically",
      currentPeriodEnd: "2026-09-26T00:00:00.000Z",
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
      collection_method: "send_invoice",
      current_period_end: 1790380800,
      items: {
        data: [
          {
            price: {
              id: "price_pro",
              nickname: null,
              unit_amount: 500000,
              currency: "usd",
              recurring: { interval: "month" },
              product: { id: "prod_org", name: "Seeker Music" },
            },
          },
        ],
      },
    } as never;
    expect(buildSubscriptionResponse({ account, organization })).toEqual({
      isPro: true,
      status: "active",
      plan: "pro",
      source: "organization",
      name: "Seeker Music",
      amountCents: 500000,
      currency: "usd",
      interval: "month",
      collectionMethod: "send_invoice",
      currentPeriodEnd: "2026-09-26T00:00:00.000Z",
    });
  });
});
