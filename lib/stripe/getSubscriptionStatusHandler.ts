import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";
import { getOrgSubscription } from "@/lib/stripe/getOrgSubscription";
import isActiveSubscription from "@/lib/stripe/isActiveSubscription";
import { validateGetSubscriptionStatusRequest } from "@/lib/stripe/validateGetSubscriptionStatusRequest";

export async function getSubscriptionStatusHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetSubscriptionStatusRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const [accountSubscription, orgSubscription] = await Promise.all([
      getActiveSubscriptionDetails(validated.accountId),
      getOrgSubscription(validated.accountId),
    ]);

    const isPro =
      isActiveSubscription(accountSubscription) || isActiveSubscription(orgSubscription);

    return NextResponse.json({ isPro }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("[getSubscriptionStatusHandler]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
