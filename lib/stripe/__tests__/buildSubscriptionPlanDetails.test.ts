import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { buildSubscriptionPlanDetails } from "@/lib/stripe/buildSubscriptionPlanDetails";

const sub = (overrides: Record<string, unknown> = {}) =>
  ({
    status: "active",
    canceled_at: null,
    collection_method: "charge_automatically",
    current_period_end: 1790380800,
    items: {
      data: [
        {
          price: {
            id: "price_pro",
            nickname: "Pro",
            unit_amount: 9900,
            currency: "usd",
            recurring: { interval: "month" },
            product: "prod_123",
          },
        },
      ],
    },
    ...overrides,
  }) as unknown as Stripe.Subscription;

describe("buildSubscriptionPlanDetails", () => {
  it("maps the first price and the subscription's collection settings", () => {
    expect(buildSubscriptionPlanDetails(sub())).toEqual({
      name: "Pro",
      amountCents: 9900,
      currency: "usd",
      interval: "month",
      collectionMethod: "charge_automatically",
      currentPeriodEnd: "2026-09-26T00:00:00.000Z",
    });
  });

  it("falls back to the expanded product name when the price has no nickname", () => {
    const s = sub();
    const price = s.items.data[0].price as unknown as Record<string, unknown>;
    price.nickname = null;
    price.product = { id: "prod_123", name: "Seeker Music" };
    expect(buildSubscriptionPlanDetails(s).name).toBe("Seeker Music");
  });

  it("returns a null name when neither nickname nor an expanded product is present", () => {
    const s = sub();
    const price = s.items.data[0].price as unknown as Record<string, unknown>;
    price.nickname = null;
    expect(buildSubscriptionPlanDetails(s).name).toBeNull();
  });

  it("reports send_invoice plans as such", () => {
    expect(
      buildSubscriptionPlanDetails(sub({ collection_method: "send_invoice" })).collectionMethod,
    ).toBe("send_invoice");
  });

  it("nulls the price-derived fields for a subscription with no items and keeps the subscription-level ones", () => {
    expect(buildSubscriptionPlanDetails(sub({ items: { data: [] } }))).toEqual({
      name: null,
      amountCents: null,
      currency: null,
      interval: null,
      collectionMethod: "charge_automatically",
      currentPeriodEnd: "2026-09-26T00:00:00.000Z",
    });
  });
});
