import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";

/**
 * Replaces `price.product` on the subscription's first item with the retrieved
 * Product when the price has no nickname, so the plan name can fall back to
 * the product name. Stripe caps list expansion at four levels, which rules
 * out expanding the product on the list call itself. Lookups that fail leave
 * the subscription unchanged.
 */
export async function expandSubscriptionProduct(
  subscription: Stripe.Subscription | null,
): Promise<Stripe.Subscription | null> {
  const price = subscription?.items?.data?.[0]?.price;
  if (!subscription || !price || price.nickname || typeof price.product !== "string") {
    return subscription;
  }
  try {
    const product = await stripeClient.products.retrieve(price.product);
    const item = { ...subscription.items.data[0], price: { ...price, product } };
    return { ...subscription, items: { ...subscription.items, data: [item] } };
  } catch (error) {
    console.error("[expandSubscriptionProduct]", error);
    return subscription;
  }
}
