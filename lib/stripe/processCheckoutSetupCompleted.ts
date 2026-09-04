import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";
import { setDefaultPaymentMethod } from "@/lib/stripe/setDefaultPaymentMethod";

const idOf = (ref: string | { id: string } | null | undefined) =>
  typeof ref === "string" ? ref : (ref?.id ?? null);

/**
 * On `checkout.session.completed` for a `setup`-mode session (a card saved via
 * `POST /api/accounts/{id}/payment-method`), promote the saved card to the
 * customer's invoice default so credit purchases and auto top-up can charge it.
 */
export async function processCheckoutSetupCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (session.mode !== "setup") return;

  const customerId = idOf(session.customer);
  const setupIntentId = idOf(session.setup_intent);
  if (!customerId || !setupIntentId) return;

  const setupIntent = await stripeClient.setupIntents.retrieve(setupIntentId);
  const paymentMethodId = idOf(setupIntent.payment_method);
  if (!paymentMethodId) return;

  await setDefaultPaymentMethod(customerId, paymentMethodId);
}
