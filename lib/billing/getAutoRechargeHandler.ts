import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAutoRechargeParams } from "@/lib/billing/validateAutoRechargeParams";
import { findStripeCustomerForAccount } from "@/lib/stripe/findStripeCustomerForAccount";
import { getAutoRechargeOptOut } from "@/lib/stripe/getAutoRechargeOptOut";

/**
 * GET /api/accounts/[id]/auto-recharge
 *
 * Returns whether automatic top-up is enabled for the account. `enabled: true`
 * is the default; `enabled: false` means the account's Stripe Customer carries
 * the opt-out metadata flag and no off-session charge will be attempted.
 *
 * Read-only: an account with no Stripe Customer yet is enabled by default and
 * the lookup never provisions one.
 */
export async function getAutoRechargeHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const validated = await validateAutoRechargeParams(request, id);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const customer = await findStripeCustomerForAccount(validated);
    const optedOut = customer ? await getAutoRechargeOptOut(customer) : false;

    return NextResponse.json(
      { account_id: validated, enabled: !optedOut },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[getAutoRechargeHandler]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
