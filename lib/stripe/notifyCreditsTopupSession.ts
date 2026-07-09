import type Stripe from "stripe";
import { CREDIT_TOPUP_PURPOSE } from "@/lib/stripe/creditsTopupPurpose";
import { buildCustomerSalesContext } from "@/lib/stripe/buildCustomerSalesContext";
import { formatUsd } from "@/lib/stripe/formatUsd";
import { sendSalesNotification } from "@/lib/telegram/sendSalesNotification";

/**
 * Notification hook for `checkout.session.completed` credits top-ups,
 * alongside (never inside) the `processCreditsTopupSession` grant. The
 * session is the notify trigger for manual top-ups because their
 * PaymentIntents carry no purpose metadata.
 */
export async function notifyCreditsTopupSession(session: Stripe.Checkout.Session): Promise<void> {
  if (session.metadata?.purpose !== CREDIT_TOPUP_PURPOSE) return;
  if (session.payment_status !== "paid") return;

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!customerId) return;

  const ctx = await buildCustomerSalesContext(customerId, session.customer_details?.email);

  const lines = ["💳 Credits top-up", ctx.customerLine];
  if (session.amount_total != null) lines.push(`Amount: ${formatUsd(session.amount_total)}`);
  if (session.metadata.credits) lines.push(`Credits: ${session.metadata.credits}`);
  lines.push(ctx.lifetimeLine);

  await sendSalesNotification({ email: ctx.email, text: lines.join("\n") });
}
