import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

const idSchema = z.string().uuid("id must be a valid UUID");
const limitSchema = z.coerce
  .number()
  .int("limit must be between 1 and 100")
  .min(1, "limit must be between 1 and 100")
  .max(100, "limit must be between 1 and 100")
  .default(20);

export interface GetPaymentsParams {
  accountId: string;
  limit: number;
  startingAfter: string | undefined;
}

/**
 * Validates the `[id]` path param and `limit` / `startingAfter` query params
 * for GET /api/accounts/{id}/payments, then confirms the caller may access
 * that account (own account or accessible via organization membership).
 */
export async function validateGetPaymentsParams(
  request: NextRequest,
  id: string,
): Promise<GetPaymentsParams | NextResponse> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return badRequest(parsedId.error.issues[0].message);
  }

  const rawLimit = request.nextUrl.searchParams.get("limit");
  const parsedLimit = limitSchema.safeParse(rawLimit ?? undefined);
  if (!parsedLimit.success) {
    return badRequest("limit must be between 1 and 100");
  }

  const auth = await validateAuthContext(request, { accountId: parsedId.data });
  if (auth instanceof NextResponse) {
    return auth;
  }

  const startingAfter = request.nextUrl.searchParams.get("startingAfter") ?? undefined;
  return { accountId: parsedId.data, limit: parsedLimit.data, startingAfter };
}

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400, headers: getCorsHeaders() });
}
