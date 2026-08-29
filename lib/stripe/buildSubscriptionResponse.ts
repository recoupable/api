import type Stripe from "stripe";
import isActiveSubscription from "@/lib/stripe/isActiveSubscription";
import { toStatus, type SubscriptionStatus } from "@/lib/stripe/toStatus";
import { resolvePlan } from "@/lib/plans/resolvePlan";

export type SubscriptionSource = "account" | "organization";
export type { SubscriptionStatus };

export interface SubscriptionResponse {
  isPro: boolean;
  status: SubscriptionStatus;
  plan: string | null;
  source: SubscriptionSource | null;
}

const inactive: SubscriptionResponse = {
  isPro: false,
  status: "none",
  plan: null,
  source: null,
};

/**
 * Maps the account- and organization-level subscriptions into the documented response shape.
 * Account subscription wins when both are active; `plan` follows `resolvePlan`, so a Starter
 * price reports `starter` with `isPro` false.
 */
export function buildSubscriptionResponse(args: {
  account: Stripe.Subscription | null;
  organization: Stripe.Subscription | null;
}): SubscriptionResponse {
  if (isActiveSubscription(args.account) && args.account) {
    const plan = resolvePlan({ accountSub: args.account, orgSub: null, isEnterprise: false });
    return {
      isPro: plan === "pro",
      status: toStatus(args.account.status),
      plan,
      source: "account",
    };
  }
  if (isActiveSubscription(args.organization) && args.organization) {
    return {
      isPro: true,
      status: toStatus(args.organization.status),
      plan: "pro",
      source: "organization",
    };
  }
  return inactive;
}
