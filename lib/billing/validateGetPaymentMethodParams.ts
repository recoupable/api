import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

const idSchema = z.string().uuid("id must be a valid UUID");

/**
 * Validates the `[id]` path param for GET /api/accounts/{id}/payment-method
 * and confirms the caller may access that account (own account or accessible
 * via organization membership). Returns the validated UUID on success, or a
 * NextResponse with the upstream auth/validation error to forward.
 */
export async function validateGetPaymentMethodParams(
  request: NextRequest,
  id: string,
): Promise<string | NextResponse> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const auth = await validateAuthContext(request, { accountId: parsed.data });
  if (auth instanceof NextResponse) {
    return auth;
  }

  return parsed.data;
}
