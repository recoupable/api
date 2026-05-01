import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";
import { getOrgSubscription } from "@/lib/stripe/getOrgSubscription";
import isActiveSubscription from "@/lib/stripe/isActiveSubscription";

export interface SubscriptionStatusResponse {
  isPro: boolean;
}

/**
 * Handles GET /api/subscription — returns whether the authenticated
 * account or any of its organizations has an active Stripe
 * subscription.
 */
export async function getSubscriptionStatusHandler(request: NextRequest): Promise<NextResponse> {
  const authContext = await validateAuthContext(request, {});
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  try {
    const [accountSubscription, orgSubscription] = await Promise.all([
      getActiveSubscriptionDetails(authContext.accountId),
      getOrgSubscription(authContext.accountId),
    ]);

    const isPro =
      isActiveSubscription(accountSubscription) || isActiveSubscription(orgSubscription);

    return NextResponse.json({ isPro }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("/api/subscription error", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
