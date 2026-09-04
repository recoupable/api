import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { buildSubscriptionResponse } from "@/lib/stripe/buildSubscriptionResponse";

const activeSub = (status: Stripe.Subscription.Status = "active") =>
  ({
    status,
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
            product: "prod_pro",
          },
        },
      ],
    },
  }) as unknown as Stripe.Subscription;

const nullDetails = {
  name: null,
  amountCents: null,
  currency: null,
  interval: null,
  collectionMethod: null,
  currentPeriodEnd: null,
};

const proDetails = {
  name: "Pro",
  amountCents: 9900,
  currency: "usd",
  interval: "month",
  collectionMethod: "charge_automatically",
  currentPeriodEnd: "2026-09-26T00:00:00.000Z",
};

describe("buildSubscriptionResponse", () => {
  it("returns isPro:false / none / null / null when neither subscription is active", () => {
    expect(buildSubscriptionResponse({ account: null, organization: null })).toEqual({
      isPro: false,
      status: "none",
      plan: null,
      source: null,
      ...nullDetails,
    });
  });

  it("prefers the account subscription when active", () => {
    expect(
      buildSubscriptionResponse({
        account: activeSub("active"),
        organization: activeSub("trialing"),
      }),
    ).toEqual({
      isPro: true,
      status: "active",
      plan: "pro",
      source: "account",
      ...proDetails,
    });
  });

  it("falls back to the organization subscription when only org is active", () => {
    expect(
      buildSubscriptionResponse({
        account: null,
        organization: activeSub("trialing"),
      }),
    ).toEqual({
      isPro: true,
      status: "trialing",
      plan: "pro",
      source: "organization",
      ...proDetails,
    });
  });

  it("treats trialing-with-canceled_at as inactive", () => {
    const canceledTrial = {
      status: "trialing",
      canceled_at: 1700000000,
    } as unknown as Stripe.Subscription;

    expect(buildSubscriptionResponse({ account: canceledTrial, organization: null })).toEqual({
      isPro: false,
      status: "none",
      plan: null,
      source: null,
      ...nullDetails,
    });
  });

  it("normalizes unsupported Stripe statuses to 'none' when somehow active", () => {
    const weird = { status: "incomplete", canceled_at: null } as unknown as Stripe.Subscription;
    expect(buildSubscriptionResponse({ account: weird, organization: null })).toEqual({
      isPro: false,
      status: "none",
      plan: null,
      source: null,
      ...nullDetails,
    });
  });
});
