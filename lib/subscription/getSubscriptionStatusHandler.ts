import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";
import { getOrgSubscription } from "@/lib/stripe/getOrgSubscription";
import isActiveSubscription from "@/lib/stripe/isActiveSubscription";
import { validateSubscriptionStatusQuery } from "@/lib/subscription/validateSubscriptionStatusQuery";

export interface SubscriptionStatusResponse {
  isPro: boolean;
}

/**
 * Handles GET /api/subscription/status — returns whether the account or
 * any of its organizations has an active Stripe subscription.
 */
export async function getSubscriptionStatusHandler(request: NextRequest): Promise<NextResponse> {
  const validated = validateSubscriptionStatusQuery(request.nextUrl.searchParams);
  if (validated instanceof NextResponse) {
    return validated;
  }

  try {
    const [accountSubscription, orgSubscription] = await Promise.all([
      getActiveSubscriptionDetails(validated.accountId),
      getOrgSubscription(validated.accountId),
    ]);

    const isPro =
      isActiveSubscription(accountSubscription) || isActiveSubscription(orgSubscription);

    return NextResponse.json({ isPro }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("/api/subscription/status error", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
