import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
// The card-on-file body is the same single `successUrl` contract as the paid
// subscription session, so the strict schema is shared rather than duplicated.
import { createSubscriptionSessionBodySchema } from "@/lib/stripe/createSubscriptionSessionSchemas";
import { mapToSubscriptionSessionError } from "@/lib/stripe/mapToSubscriptionSessionError";

export type ValidatedCreateCardOnFileSessionRequest = {
  accountId: string;
  successUrl: string;
};

/**
 * Validate a card-on-file session request: the body must be `{ successUrl }`
 * and the account is always resolved from the credentials, never read from the
 * caller-supplied body (the schema is strict, so an `accountId` key 400s).
 *
 * @param request - The incoming HTTP request.
 * @returns The validated account id and success URL, or an error response.
 */
export async function validateCreateCardOnFileSessionRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedCreateCardOnFileSessionRequest> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const parsed = createSubscriptionSessionBodySchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first.message }, { status: 400, headers: getCorsHeaders() });
  }

  const authContext = await validateAuthContext(request, {});
  if (authContext instanceof NextResponse) {
    return mapToSubscriptionSessionError(authContext);
  }

  return {
    accountId: authContext.accountId,
    successUrl: parsed.data.successUrl,
  };
}
