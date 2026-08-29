import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";
import { resolvePlanFromPriceId } from "@/lib/stripe/checkout/resolvePlanFromPriceId";
import { stampSubscriptionAccount } from "@/lib/stripe/checkout/stampSubscriptionAccount";
import { WEBHOOK_CREATED_BY } from "@/lib/stripe/checkout/webhookCreatedBy";
import type { CheckoutPlan } from "@/lib/stripe/checkout/checkoutPlan";

export type ClaimSubscriptionResult =
  | { status: "success"; subscription_id: string; plan: CheckoutPlan }
  | { status: "error"; error: "session_not_found" | "no_subscription" | "already_claimed" };

/**
 * Attaches the subscription behind a Checkout session to the caller when it
 * is unowned or still owned by the placeholder account the webhook created
 * for the billing email. Any other owner keeps it (409 upstream).
 */
export async function claimSubscription(args: {
  sessionId: string;
  accountId: string;
}): Promise<ClaimSubscriptionResult> {
  const { sessionId, accountId } = args;

  let session: Stripe.Checkout.Session;
  try {
    session = await stripeClient.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });
  } catch (error) {
    if ((error as { code?: string }).code === "resource_missing") {
      return { status: "error", error: "session_not_found" };
    }
    throw error;
  }

  const subscription = session.subscription;
  if (!subscription || typeof subscription === "string") {
    return { status: "error", error: "no_subscription" };
  }

  const plan = resolvePlanFromPriceId(subscription.items?.data?.[0]?.price?.id);
  const owner = subscription.metadata?.accountId;
  const placeholder = subscription.metadata?.created_by === WEBHOOK_CREATED_BY;
  // Already the caller's and no marker to clear: nothing to write.
  if (owner === accountId && !placeholder) {
    return { status: "success", subscription_id: subscription.id, plan };
  }
  if (owner && owner !== accountId && !placeholder) {
    return { status: "error", error: "already_claimed" };
  }

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  await stampSubscriptionAccount({
    subscriptionId: subscription.id,
    customerId: customerId ?? null,
    accountId,
    createdBy: "",
  });
  return { status: "success", subscription_id: subscription.id, plan };
}
