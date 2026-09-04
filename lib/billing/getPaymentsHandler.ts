import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetPaymentsParams } from "@/lib/billing/validateGetPaymentsParams";
import { findStripeCustomerForAccount } from "@/lib/stripe/findStripeCustomerForAccount";
import { listAccountInvoices } from "@/lib/billing/listAccountInvoices";
import { buildPaymentsResponse } from "@/lib/billing/buildPaymentsResponse";
import { mapToPaymentMethodError } from "@/lib/billing/mapToPaymentMethodError";

/**
 * GET /api/accounts/[id]/payments
 *
 * The account's Stripe invoices, newest first: subscription renewals, credit
 * purchases and invoiced enterprise plans alike. An account with no Stripe
 * customer yet gets an empty list, never a 404, so the billing page's empty
 * state is an ordinary response. Read-only: never creates a customer.
 */
export async function getPaymentsHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const validated = await validateGetPaymentsParams(request, id);
    if (validated instanceof NextResponse) {
      return mapToPaymentMethodError(validated);
    }

    const customer = await findStripeCustomerForAccount(validated.accountId);
    const page = customer
      ? await listAccountInvoices({
          customerId: customer,
          limit: validated.limit,
          startingAfter: validated.startingAfter,
        })
      : { invoices: [], hasMore: false };

    return NextResponse.json(buildPaymentsResponse({ accountId: validated.accountId, ...page }), {
      status: 200,
      headers: getCorsHeaders(),
    });
  } catch (error) {
    console.error("[getPaymentsHandler]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
