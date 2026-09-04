import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/networking/errorResponse";
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
    return errorResponse(parsedId.error.issues[0].message, 400);
  }

  const rawLimit = request.nextUrl.searchParams.get("limit");
  const parsedLimit = limitSchema.safeParse(rawLimit ?? undefined);
  if (!parsedLimit.success) {
    return errorResponse("limit must be between 1 and 100", 400);
  }

  const auth = await validateAuthContext(request, { accountId: parsedId.data });
  if (auth instanceof NextResponse) {
    return auth;
  }

  const startingAfter = request.nextUrl.searchParams.get("startingAfter") ?? undefined;
  return { accountId: parsedId.data, limit: parsedLimit.data, startingAfter };
}
