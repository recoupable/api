import type Stripe from "stripe";
import isActiveSubscription from "@/lib/stripe/isActiveSubscription";
import { STRIPE_STARTER_PRICE_ID } from "@/lib/stripe/config";
import type { Plan } from "@/lib/plans/types";

/**
 * Maps the three plan sources to one plan. Any active non-Starter account
 * subscription, any active organization subscription, or an enterprise
 * domain is pro; an active account subscription on the Starter price is
 * starter; nothing active is free. The most generous source wins, so a
 * Starter subscriber whose organization is on Pro gets Pro.
 */
export function resolvePlan(args: {
  accountSub: Stripe.Subscription | null;
  orgSub: Stripe.Subscription | null;
  isEnterprise: boolean;
}): Plan {
  const { accountSub, orgSub, isEnterprise } = args;
  if (isEnterprise || isActiveSubscription(orgSub)) return "pro";
  if (!isActiveSubscription(accountSub) || !accountSub) return "free";
  const priceId = accountSub.items?.data?.[0]?.price?.id;
  const isStarter = STRIPE_STARTER_PRICE_ID !== "" && priceId === STRIPE_STARTER_PRICE_ID;
  return isStarter ? "starter" : "pro";
}
