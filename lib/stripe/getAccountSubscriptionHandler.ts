import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";
import { getOrgSubscription } from "@/lib/stripe/getOrgSubscription";
import { validateAccountSubscriptionParams } from "@/lib/stripe/validateAccountSubscriptionParams";
import { buildSubscriptionResponse } from "@/lib/stripe/buildSubscriptionResponse";
import { mapToSubscriptionSessionError } from "@/lib/stripe/mapToSubscriptionSessionError";

/**
 * GET /api/accounts/[id]/subscription
 *
 * Returns the documented subscription resource for an account, including coverage
 * via organization membership. Forwards auth/validation failures as `{ error }` bodies.
 */
export async function getAccountSubscriptionHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const validated = await validateAccountSubscriptionParams(request, id);
    if (validated instanceof NextResponse) {
      return mapToSubscriptionSessionError(validated);
    }

    const [account, organization] = await Promise.all([
      getActiveSubscriptionDetails(validated),
      getOrgSubscription(validated),
    ]);

    return NextResponse.json(buildSubscriptionResponse({ account, organization }), {
      status: 200,
      headers: getCorsHeaders(),
    });
  } catch (error) {
    console.error("[getAccountSubscriptionHandler]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
