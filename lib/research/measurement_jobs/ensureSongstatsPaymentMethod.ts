import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { accountHasPaymentMethod } from "@/lib/stripe/accountHasPaymentMethod";

/**
 * Payment-method gate for Songstats-backed work (the heavily quota-capped
 * provider). The authenticated account must have a card on file before it can
 * spend Songstats quota. Returns `null` to proceed, otherwise a neutral 402.
 * Research requests never create checkout sessions or initiate card setup.
 *
 * @param accountId - The authenticated account.
 * @returns `null` when a card exists, else a 402 without transactional links.
 */
export async function ensureSongstatsPaymentMethod(
  accountId: string,
): Promise<NextResponse | null> {
  if (await accountHasPaymentMethod(accountId)) return null;

  return NextResponse.json(
    {
      status: "error",
      error: "payment_method_required",
      message: "This research feature is unavailable with the account's current entitlements.",
    },
    { status: 402, headers: getCorsHeaders() },
  );
}
