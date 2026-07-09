import type Stripe from "stripe";
import { CREDIT_AUTO_RECHARGE_PURPOSE } from "@/lib/credits/const";
import { buildCustomerSalesContext } from "@/lib/stripe/buildCustomerSalesContext";
import { formatUsd } from "@/lib/stripe/formatUsd";
import { sendSalesNotification } from "@/lib/telegram/sendSalesNotification";

/**
 * Notification hook for `payment_intent.succeeded`, deliberately outside
 * the credit-granting guard in `processCreditsTopupPaymentIntent`: only
 * auto-recharge PIs notify here. Manual top-ups notify from their
 * checkout session (their PIs carry no purpose metadata), and bare PIs
 * (subscription/checkout charges) notify via `invoice.paid` /
 * `checkout.session.completed` — never from the PI path, or every
 * subscription payment would notify twice.
 */
export async function notifyCreditsTopupPaymentIntent(
  paymentIntent: Stripe.PaymentIntent,
): Promise<void> {
  if (paymentIntent.metadata?.purpose !== CREDIT_AUTO_RECHARGE_PURPOSE) return;

  const customerId =
    typeof paymentIntent.customer === "string"
      ? paymentIntent.customer
      : paymentIntent.customer?.id;
  if (!customerId) return;

  const ctx = await buildCustomerSalesContext(customerId);

  const lines = [
    "💳 Credits auto-recharge",
    ctx.customerLine,
    `Amount: ${formatUsd(paymentIntent.amount)}`,
  ];
  if (paymentIntent.metadata.credits) lines.push(`Credits: ${paymentIntent.metadata.credits}`);
  lines.push(ctx.lifetimeLine);

  await sendSalesNotification({ email: ctx.email, text: lines.join("\n") });
}
