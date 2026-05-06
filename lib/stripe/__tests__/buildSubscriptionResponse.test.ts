import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { buildSubscriptionResponse } from "@/lib/stripe/buildSubscriptionResponse";

const activeSub = (status: Stripe.Subscription.Status = "active") =>
  ({ status, canceled_at: null }) as unknown as Stripe.Subscription;

describe("buildSubscriptionResponse", () => {
  it("returns isPro:false / none / null / null when neither subscription is active", () => {
    expect(buildSubscriptionResponse({ account: null, organization: null })).toEqual({
      isPro: false,
      status: "none",
      plan: null,
      source: null,
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
    });
  });

  it("normalizes unsupported Stripe statuses to 'none' when somehow active", () => {
    const weird = { status: "incomplete", canceled_at: null } as unknown as Stripe.Subscription;
    expect(buildSubscriptionResponse({ account: weird, organization: null })).toEqual({
      isPro: false,
      status: "none",
      plan: null,
      source: null,
    });
  });
});
