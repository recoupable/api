import type Stripe from "stripe";
import { incrementRemainingCredits } from "@/lib/supabase/credits_usage/incrementRemainingCredits";
import { CREDIT_TOPUP_PURPOSE } from "@/lib/stripe/config";

export async function processCreditsTopupSession(session: Stripe.Checkout.Session): Promise<void> {
  if (session.mode !== "payment") return;

  const metadata = session.metadata ?? {};
  if (metadata.purpose !== CREDIT_TOPUP_PURPOSE) return;

  if (session.payment_status !== "paid") {
    console.warn(
      `[processCreditsTopupSession] skipping session ${session.id} with payment_status=${session.payment_status}`,
    );
    return;
  }

  const accountId = metadata.accountId;
  if (!accountId || typeof accountId !== "string") {
    throw new Error(`Missing accountId metadata on credits_topup session ${session.id}`);
  }

  const creditsRaw = metadata.credits;
  const credits = creditsRaw ? Number(creditsRaw) : NaN;
  if (!Number.isInteger(credits) || credits <= 0) {
    throw new Error(
      `Invalid credits metadata "${creditsRaw}" on credits_topup session ${session.id}`,
    );
  }

  await incrementRemainingCredits({ accountId, delta: credits });
}
