import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetPaymentMethodParams } from "@/lib/billing/validateGetPaymentMethodParams";
import { findStripeCustomerForAccount } from "@/lib/stripe/findStripeCustomerForAccount";
import { getDefaultPaymentMethodDetails } from "@/lib/stripe/getDefaultPaymentMethodDetails";
import { buildPaymentMethodResponse } from "@/lib/billing/buildPaymentMethodResponse";
import { mapToPaymentMethodError } from "@/lib/billing/mapToPaymentMethodError";

/**
 * GET /api/accounts/[id]/payment-method
 *
 * Returns the default Stripe payment method on file for the account.
 * `card` is `null` when the current lookup has no supported default card,
 * including when no tagged customer exists. This does not establish the
 * account's card history or absence of other saved cards. Callers use the
 * resolved card to choose pre-charge confirmation or checkout.
 * Expired cards are still returned with
 * their original `exp_month` / `exp_year`; callers should warn before
 * relying on the saved card for an off-session charge.
 */
export async function getPaymentMethodHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const validated = await validateGetPaymentMethodParams(request, id);
    if (validated instanceof NextResponse) {
      return mapToPaymentMethodError(validated);
    }

    // A read must not provision a customer. Without a currently tagged
    // customer, return card:null rather than creating one during lookup.
    const customer = await findStripeCustomerForAccount(validated);
    const card = customer ? await getDefaultPaymentMethodDetails(customer) : null;

    return NextResponse.json(buildPaymentMethodResponse({ accountId: validated, card }), {
      status: 200,
      headers: getCorsHeaders(),
    });
  } catch (error) {
    console.error("[getPaymentMethodHandler]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
