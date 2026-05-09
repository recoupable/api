import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";

export async function createBillingPortalSession(
  stripeCustomerId: string,
  returnUrl: string,
): Promise<Stripe.BillingPortal.Session> {
  return stripeClient.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });
}
