import stripeClient from "@/lib/stripe/client";

/**
 * Sets or clears the automatic top-up opt-out flag on a Stripe Customer.
 *
 * Presence semantics: opting out stamps `auto_recharge_opt_out: "true"`;
 * opting back in sets the key to `""`, which Stripe treats as a delete —
 * the key disappears from metadata entirely. Never write `"false"`: readers
 * check presence, not value, so a `"false"` string would still opt out.
 */
export async function setAutoRechargeOptOut(customerId: string, optOut: boolean): Promise<void> {
  await stripeClient.customers.update(customerId, {
    metadata: { auto_recharge_opt_out: optOut ? "true" : "" },
  });
}
