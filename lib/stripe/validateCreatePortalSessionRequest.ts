import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { createPortalSessionBodySchema } from "@/lib/stripe/createPortalSessionSchemas";
import { mapToSubscriptionSessionError } from "@/lib/stripe/mapToSubscriptionSessionError";

export type ValidatedCreatePortalSessionRequest = {
  accountId: string;
  returnUrl: string;
};

export async function validateCreatePortalSessionRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedCreatePortalSessionRequest> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const parsed = createPortalSessionBodySchema.safeParse(body);
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
    returnUrl: parsed.data.returnUrl,
  };
}
