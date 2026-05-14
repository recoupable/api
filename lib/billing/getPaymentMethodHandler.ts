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
 * `card` is `null` when no payment method has been saved yet — callers use
 * this to decide whether to show a pre-charge confirmation or route to a
 * checkout session to collect one. Expired cards are still returned with
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

    // Read-only lookup: a GET should never have the side-effect of creating
    // a Stripe Customer. If the account has never had one provisioned, it
    // can't have a saved card either — short-circuit to card:null.
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
