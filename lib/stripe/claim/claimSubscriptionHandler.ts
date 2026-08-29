import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { claimSubscription } from "@/lib/stripe/claim/claimSubscription";
import { claimSubscriptionBodySchema } from "@/lib/stripe/claim/claimSubscriptionSchemas";

const ERROR_STATUS = {
  session_not_found: 404,
  already_claimed: 409,
  no_subscription: 400,
} as const;

/**
 * `POST /api/subscriptions/claim`: body then auth (the canonical order),
 * then the claim. Errors use the `{ status: "error", error }` envelope.
 */
export async function claimSubscriptionHandler(request: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const parsed = claimSubscriptionBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { status: "error", error: parsed.error.issues[0].message },
        { status: 400, headers: getCorsHeaders() },
      );
    }

    const auth = await validateAuthContext(request, {});
    if (auth instanceof NextResponse) return auth;

    const result = await claimSubscription({
      sessionId: parsed.data.session_id,
      accountId: auth.accountId,
    });
    const status = result.status === "success" ? 200 : ERROR_STATUS[result.error];
    return NextResponse.json(result, { status, headers: getCorsHeaders() });
  } catch (error) {
    console.error("[claimSubscriptionHandler]", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
