import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const createStripeSessionBodySchema = z.object({
  successUrl: z
    .string({ message: "successUrl is required" })
    .url({ message: "successUrl must be a valid URL" }),
  accountId: z.string().uuid({ message: "accountId must be a valid UUID" }).optional(),
});

export type CreateStripeSessionBody = z.infer<typeof createStripeSessionBodySchema>;

export type ValidatedCreateStripeSessionRequest = {
  accountId: string;
  successUrl: string;
};

/**
 * Validates POST /api/subscriptions/sessions request.
 *
 * Parses and validates the request body, then authenticates via
 * x-api-key or Authorization bearer token. Resolves the accountId
 * from auth context, with optional admin-override from the request body.
 *
 * @param request - The NextRequest object.
 * @returns A NextResponse with an error if validation fails, or the validated request data.
 */
export async function validateCreateStripeSessionBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedCreateStripeSessionRequest> {
  const body = await safeParseJson(request);

  const result = createStripeSessionBodySchema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const authContext = await validateAuthContext(request, {
    accountId: result.data.accountId,
  });

  if (authContext instanceof NextResponse) {
    return authContext;
  }

  return {
    accountId: authContext.accountId,
    successUrl: result.data.successUrl,
  };
}
