import { z } from "zod";
import stripeClient from "@/lib/stripe/client";

/** The unguessable checkout ID is a download-only bearer capability, never an account session. */
export async function verifyPluginPurchase(input: unknown): Promise<boolean> {
  const parsed = z
    .object({ sessionId: z.string().regex(/^cs_(?:test_|live_)?[A-Za-z0-9]{20,240}$/) })
    .strict()
    .safeParse(input);
  if (!parsed.success) return false;
  const session = await stripeClient.checkout.sessions.retrieve(parsed.data.sessionId);
  if (
    session.mode !== "subscription" ||
    session.status !== "complete" ||
    session.payment_status !== "paid" ||
    session.metadata?.fulfillment !== "recoup-plugin"
  )
    return false;
  const id =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!id) return false;
  const subscription = await stripeClient.subscriptions.retrieve(id);
  return (
    subscription.status === "active" &&
    ["starter", "pro"].includes(subscription.metadata?.plan ?? "")
  );
}
