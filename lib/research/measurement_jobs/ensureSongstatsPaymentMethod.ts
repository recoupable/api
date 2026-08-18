import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { accountHasPaymentMethod } from "@/lib/stripe/accountHasPaymentMethod";
import { createCardOnFileSession } from "@/lib/stripe/createCardOnFileSession";
import { CREDIT_BILLING_URL } from "@/lib/credits/const";

/**
 * Payment-method gate for Songstats-backed work (the heavily quota-capped
 * provider). The authenticated account must have a card on file before it can
 * spend Songstats quota. Returns `null` to proceed; otherwise a **402** carrying
 * a Stripe Checkout URL for the free tier (subscription + trial) so the caller
 * can add a card. Mirrors the credit gate's short-circuit shape.
 *
 * @param accountId - The authenticated account.
 * @returns `null` when a card exists, else a 402 NextResponse with `checkoutUrl`.
 *
 * Note: unlike the credit gate, this one still mints a Checkout Session per
 * denied request. It is a payment-method gate rather than a credit gate and is
 * out of scope here, but it is the same shape of problem.
 */
export async function ensureSongstatsPaymentMethod(
  accountId: string,
): Promise<NextResponse | null> {
  if (await accountHasPaymentMethod(accountId)) return null;

  const session = await createCardOnFileSession(accountId, CREDIT_BILLING_URL);
  return NextResponse.json(
    {
      status: "error",
      error:
        "A payment method is required to use Songstats-backed endpoints. Add a card to continue.",
      checkoutUrl: session.url,
    },
    { status: 402, headers: getCorsHeaders() },
  );
}
