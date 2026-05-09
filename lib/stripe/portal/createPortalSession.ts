import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";

export async function createPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<Stripe.BillingPortal.Session> {
  return stripeClient.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
