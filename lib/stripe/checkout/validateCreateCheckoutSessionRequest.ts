import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { mapToSubscriptionSessionError } from "@/lib/stripe/mapToSubscriptionSessionError";

export const createCheckoutSessionBodySchema = z
  .object({
    successUrl: z.string().min(1, "successUrl is required").url("successUrl must be a valid URL"),
  })
  .strict();

export type ValidatedCreateCheckoutSessionRequest = {
  accountId: string;
  successUrl: string;
};

export async function validateCreateCheckoutSessionRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedCreateCheckoutSessionRequest> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const parsed = createCheckoutSessionBodySchema.safeParse(body);
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
