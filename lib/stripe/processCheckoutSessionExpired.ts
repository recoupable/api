import type Stripe from "stripe";
import { start } from "workflow/api";
import { abandonedCheckoutWorkflow } from "@/app/workflows/abandonedCheckoutWorkflow";
import type { AbandonedCheckoutPlan } from "@/lib/emails/lifecycle/buildAbandonedCheckoutEmail";

/**
 * Webhook processor for `checkout.session.expired`: a subscription checkout
 * the visitor opened and never paid. Hands the email to the delayed
 * abandoned-checkout workflow; the send itself happens 24h later.
 * Payment-mode (credit top-up) sessions and sessions without an email are
 * ignored.
 */
export async function processCheckoutSessionExpired(
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (session.mode !== "subscription") return;

  const email = session.customer_details?.email ?? session.customer_email ?? null;
  if (!email) return;

  const plan: AbandonedCheckoutPlan = session.metadata?.plan === "starter" ? "starter" : "pro";

  await start(abandonedCheckoutWorkflow, [{ sessionId: session.id, email, plan }]);
}
