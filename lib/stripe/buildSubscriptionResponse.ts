import type Stripe from "stripe";
import isActiveSubscription from "@/lib/stripe/isActiveSubscription";
import { toStatus, type SubscriptionStatus } from "@/lib/stripe/toStatus";
import { resolvePlan } from "@/lib/plans/resolvePlan";
import {
  buildSubscriptionPlanDetails,
  type SubscriptionPlanDetails,
} from "@/lib/stripe/buildSubscriptionPlanDetails";

export type SubscriptionSource = "account" | "organization";
export type { SubscriptionStatus };

export interface SubscriptionResponse extends SubscriptionPlanDetails {
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
  name: null,
  amountCents: null,
  currency: null,
  interval: null,
  collectionMethod: null,
  currentPeriodEnd: null,
};

/**
 * Maps the account- and organization-level subscriptions into the documented response shape.
 * `plan` follows `resolvePlan` (most generous source wins), so a Starter account on a Pro
 * organization reports `pro`. `source` is the subscription that confers that plan.
 */
export function buildSubscriptionResponse(args: {
  account: Stripe.Subscription | null;
  organization: Stripe.Subscription | null;
}): SubscriptionResponse {
  const plan = resolvePlan({
    accountSub: args.account,
    orgSub: args.organization,
    isEnterprise: false,
  });
  if (plan === "free") return inactive;

  const accountAlone = resolvePlan({
    accountSub: args.account,
    orgSub: null,
    isEnterprise: false,
  });
  // Org Pro over Starter (or free) account: report the organization as source.
  if (
    plan === "pro" &&
    accountAlone !== "pro" &&
    isActiveSubscription(args.organization) &&
    args.organization
  ) {
    return {
      isPro: true,
      status: toStatus(args.organization.status),
      plan: "pro",
      source: "organization",
      ...buildSubscriptionPlanDetails(args.organization),
    };
  }
  if (isActiveSubscription(args.account) && args.account) {
    return {
      isPro: plan === "pro",
      status: toStatus(args.account.status),
      plan,
      source: "account",
      ...buildSubscriptionPlanDetails(args.account),
    };
  }
  if (isActiveSubscription(args.organization) && args.organization) {
    return {
      isPro: true,
      status: toStatus(args.organization.status),
      plan: "pro",
      source: "organization",
      ...buildSubscriptionPlanDetails(args.organization),
    };
  }
  return inactive;
}
