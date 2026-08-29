import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import {
  createCheckoutBodySchema,
  type CreateCheckoutBody,
} from "@/lib/stripe/checkout/createCheckoutSchemas";
import { mapToSubscriptionSessionError } from "@/lib/stripe/mapToSubscriptionSessionError";

export type ValidatedCreateCheckoutRequest = CreateCheckoutBody & {
  /** Null for an anonymous checkout; the webhook links the account later. */
  accountId: string | null;
};

/**
 * Validates `POST /api/subscriptions/checkout`. Auth is optional: with no
 * auth header the request is anonymous; with one, it must be valid (the
 * usual 401 otherwise) so a signed-in buyer's session attaches to their
 * account instead of creating a placeholder.
 */
export async function validateCreateCheckoutRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedCreateCheckoutRequest> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const parsed = createCheckoutBodySchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first.message }, { status: 400, headers: getCorsHeaders() });
  }

  const hasAuth = request.headers.has("x-api-key") || request.headers.has("authorization");
  if (!hasAuth) {
    return { ...parsed.data, accountId: null };
  }

  const authContext = await validateAuthContext(request, {});
  if (authContext instanceof NextResponse) {
    return mapToSubscriptionSessionError(authContext);
  }
  return { ...parsed.data, accountId: authContext.accountId };
}
