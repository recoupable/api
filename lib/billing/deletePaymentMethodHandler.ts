import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetPaymentMethodParams } from "@/lib/billing/validateGetPaymentMethodParams";
import { mapToPaymentMethodError } from "@/lib/billing/mapToPaymentMethodError";
import { findStripeCustomerForAccount } from "@/lib/stripe/findStripeCustomerForAccount";
import { findDefaultCardForCustomer } from "@/lib/stripe/findDefaultCardForCustomer";
import { detachPaymentMethod } from "@/lib/stripe/detachPaymentMethod";
import { disableAutoTopUp } from "@/lib/supabase/credits_usage/disableAutoTopUp";

/**
 * `DELETE /api/accounts/{id}/payment-method`: disable top-ups and detach the selected card.
 * 204 on success; 404 when there is no customer or no card to detach.
 */
export async function deletePaymentMethodHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const validated = await validateGetPaymentMethodParams(request, id);
    if (validated instanceof NextResponse) {
      return mapToPaymentMethodError(validated);
    }

    const customer = await findStripeCustomerForAccount(validated);
    const paymentMethodId = customer ? await findDefaultCardForCustomer(customer) : null;
    if (!paymentMethodId) {
      return NextResponse.json(
        { error: "No payment method on file" },
        { status: 404, headers: getCorsHeaders() },
      );
    }

    // Persist the stop first: a settings failure must not detach the card and report success.
    // If Stripe subsequently fails, leave top-ups off rather than restoring automatic charges.
    await disableAutoTopUp(validated);
    await detachPaymentMethod(paymentMethodId);
    return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
  } catch (error) {
    console.error("[deletePaymentMethodHandler]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
