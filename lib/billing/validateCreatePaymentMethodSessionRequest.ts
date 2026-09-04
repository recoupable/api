import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { mapToPaymentMethodError } from "@/lib/billing/mapToPaymentMethodError";
import { paymentMethodSessionBodySchema } from "@/lib/billing/paymentMethodSessionBodySchema";

const idSchema = z.string().uuid("id must be a valid UUID");

export type ValidatedCreatePaymentMethodSessionRequest = {
  accountId: string;
  successUrl: string;
};

/**
 * Validate `POST /api/accounts/{id}/payment-method`: `{id}` must be a UUID the
 * caller can access (own account or a member organization), body `{ successUrl }`.
 */
export async function validateCreatePaymentMethodSessionRequest(
  request: NextRequest,
  id: string,
): Promise<NextResponse | ValidatedCreatePaymentMethodSessionRequest> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json(
      { error: parsedId.error.issues[0].message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const parsedBody = paymentMethodSessionBodySchema.safeParse(await safeParseJson(request));
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0].message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const auth = await validateAuthContext(request, { accountId: parsedId.data });
  if (auth instanceof NextResponse) {
    return mapToPaymentMethodError(auth);
  }

  return { accountId: parsedId.data, successUrl: parsedBody.data.successUrl };
}
