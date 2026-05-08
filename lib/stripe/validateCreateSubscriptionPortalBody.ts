import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { mapToSubscriptionSessionError } from "@/lib/stripe/mapToSubscriptionSessionError";

export const createSubscriptionPortalBodySchema = z
  .object({
    returnUrl: z.string().min(1, "returnUrl is required").url("returnUrl must be a valid URL"),
  })
  .strict();

export type CreateSubscriptionPortalBody = z.infer<typeof createSubscriptionPortalBodySchema>;

export type ValidatedCreateSubscriptionPortalBody = {
  accountId: string;
  returnUrl: string;
};

export async function validateCreateSubscriptionPortalBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedCreateSubscriptionPortalBody> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const parsed = createSubscriptionPortalBodySchema.safeParse(body);
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
