import type Stripe from "stripe";
import { buildCustomerSalesContext } from "@/lib/stripe/buildCustomerSalesContext";
import { formatUsd } from "@/lib/stripe/formatUsd";
import { sendSalesNotification } from "@/lib/telegram/sendSalesNotification";

/**
 * Webhook processor for `invoice.paid`: announces subscription payments
 * (card or out-of-band/wire — `invoice.payment_succeeded` misses the
 * latter). Skips $0 invoices, which Stripe issues at every trial start.
 * "First payment" is derived from the customer's lifetime value before
 * this charge, because a trial conversion arrives with
 * `billing_reason=subscription_cycle`, not `subscription_create`.
 */
export async function processInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.amount_paid || invoice.amount_paid <= 0) return;

  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const ctx = await buildCustomerSalesContext(customerId, invoice.customer_email);
  const priorLifetimeCents = ctx.lifetimeCents - invoice.amount_paid;
  const isFirst = priorLifetimeCents <= 0;

  const lines = [
    isFirst ? "💰 First subscription payment 🎉" : "💰 Subscription payment (recurring)",
    ctx.customerLine,
    `Amount: ${formatUsd(invoice.amount_paid)}`,
  ];
  if (invoice.billing_reason) lines.push(`Billing reason: ${invoice.billing_reason}`);
  lines.push(ctx.lifetimeLine);

  await sendSalesNotification({ email: ctx.email, text: lines.join("\n") });
}
