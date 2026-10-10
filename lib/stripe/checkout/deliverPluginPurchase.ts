import type Stripe from "stripe";
import { NextResponse } from "next/server";
import stripeClient from "@/lib/stripe/client";
import { RECOUP_FROM_EMAIL } from "@/lib/const";
import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { buildPluginPurchaseEmail } from "@/lib/emails/buildPluginPurchaseEmail";

/** Verified webhook only. Failures propagate for Stripe retry; no browser email trigger. */
export async function deliverPluginPurchase(eventSession: Stripe.Checkout.Session): Promise<void> {
  if (
    eventSession.mode !== "subscription" ||
    eventSession.metadata?.fulfillment !== "recoup-plugin"
  )
    return;
  // Fresh state catches previous deliveries and async-payment completion.
  const session = await stripeClient.checkout.sessions.retrieve(eventSession.id);
  if (session.payment_status !== "paid" || session.metadata?.pluginEmailSent === "true") return;
  const email = session.customer_details?.email ?? session.customer_email;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!email || !subscriptionId) throw new Error("Plugin fulfillment is missing billing details");
  const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
  if (subscription.status !== "active") return;
  if (!subscription.metadata?.accountId)
    throw new Error("Plugin account linking must complete before delivery");
  const result = await sendEmailWithResend(
    {
      from: RECOUP_FROM_EMAIL,
      to: [email],
      ...buildPluginPurchaseEmail(session.id),
    },
    { idempotencyKey: `plugin-purchase/${session.id}` },
  );
  if (!result || result instanceof NextResponse) throw new Error("Plugin delivery email failed");
  await stripeClient.checkout.sessions.update(session.id, {
    metadata: { pluginEmailSent: "true" },
  });
}
