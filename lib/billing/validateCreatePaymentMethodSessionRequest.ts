import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateGetPaymentMethodParams } from "@/lib/billing/validateGetPaymentMethodParams";
import { paymentMethodSessionBodySchema } from "@/lib/billing/paymentMethodSessionBodySchema";

export type ValidatedCreatePaymentMethodSessionRequest = {
  accountId: string;
  successUrl: string;
};

/**
 * Validates POST /api/accounts/{id}/payment-method: the path id and the
 * caller's access to it come from the same helper the GET uses, then the
 * body must be exactly `{ successUrl }`.
 */
export async function validateCreatePaymentMethodSessionRequest(
  request: NextRequest,
  id: string,
): Promise<NextResponse | ValidatedCreatePaymentMethodSessionRequest> {
  const validated = await validateGetPaymentMethodParams(request, id);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const parsedBody = paymentMethodSessionBodySchema.safeParse(await safeParseJson(request));
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0].message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return { accountId: validated, successUrl: parsedBody.data.successUrl };
}
