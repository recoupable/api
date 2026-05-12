import type { NextRequest } from "next/server";
import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";
import { STRIPE_WEBHOOK_SECRET } from "@/lib/stripe/config";

export type VerifyStripeWebhookResult = { event: Stripe.Event } | { error: string };

export async function verifyStripeWebhookEvent(
  request: NextRequest,
): Promise<VerifyStripeWebhookResult> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return { error: "Missing stripe-signature header" };
  }

  const rawBody = await request.text();
  try {
    const event = stripeClient.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
    return { event };
  } catch {
    return { error: "Invalid Stripe signature" };
  }
}
