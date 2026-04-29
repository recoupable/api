import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { createSubscriptionSessionBodySchema } from "@/lib/stripe/createSubscriptionSessionSchemas";
import { mapToSubscriptionSessionErrorResponse } from "@/lib/stripe/mapToSubscriptionSessionError";

export type ValidatedCreateSubscriptionSessionRequest = {
  accountId: string;
  successUrl: string;
};

export async function validateCreateSubscriptionSessionRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedCreateSubscriptionSessionRequest> {
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

  const authContext = await validateAuthContext(request, {
    accountId: parsed.data.accountId,
  });
  if (authContext instanceof NextResponse) {
    return mapToSubscriptionSessionErrorResponse(authContext);
  }

  return {
    accountId: authContext.accountId,
    successUrl: parsed.data.successUrl,
  };
}
