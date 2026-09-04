import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetPaymentMethodParams } from "@/lib/billing/validateGetPaymentMethodParams";
import { mapToPaymentMethodError } from "@/lib/billing/mapToPaymentMethodError";
import { findStripeCustomerForAccount } from "@/lib/stripe/findStripeCustomerForAccount";
import { findDefaultPaymentMethodForCustomer } from "@/lib/stripe/findDefaultPaymentMethodForCustomer";
import { detachPaymentMethod } from "@/lib/stripe/detachPaymentMethod";

/**
 * `DELETE /api/accounts/{id}/payment-method`: detach the account's default card.
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
    const paymentMethodId = customer ? await findDefaultPaymentMethodForCustomer(customer) : null;
    if (!paymentMethodId) {
      return NextResponse.json(
        { error: "No payment method on file" },
        { status: 404, headers: getCorsHeaders() },
      );
    }

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
