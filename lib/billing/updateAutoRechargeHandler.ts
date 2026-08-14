import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateUpdateAutoRechargeBody } from "@/lib/billing/validateUpdateAutoRechargeBody";
import { resolveStripeCustomerForAccount } from "@/lib/stripe/resolveStripeCustomerForAccount";
import { setAutoRechargeOptOut } from "@/lib/stripe/setAutoRechargeOptOut";

/**
 * PATCH /api/accounts/[id]/auto-recharge
 *
 * Enables or disables automatic top-up for the account. The setting lives on
 * the account's Stripe Customer (`auto_recharge_opt_out` metadata key), so it
 * survives card changes: disabling never detaches the saved card, and
 * re-enabling requires no card re-entry.
 *
 * Resolves the Customer via `resolveStripeCustomerForAccount` (the same
 * `metadata.accountId` lookup the charge path uses) so the flag always lands
 * on the Customer the gate reads — provisioning one if the account has never
 * had a Stripe Customer.
 */
export async function updateAutoRechargeHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const validated = await validateUpdateAutoRechargeBody(request, id);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const customer = await resolveStripeCustomerForAccount(validated.accountId);
    await setAutoRechargeOptOut(customer, !validated.enabled);

    return NextResponse.json(
      { account_id: validated.accountId, enabled: validated.enabled },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[updateAutoRechargeHandler]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
