import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";

const querySchema = z.object({ accountId: z.tuple([z.string().uuid()]) });

/**
 * Validates one accountId UUID and the caller's existing access to that account.
 * Authentication must not create an account as a side effect of this read.
 *
 * @param request - Compatibility credits GET request
 * @returns Authorized target account ID, or a validation/authentication error
 */
export async function validateGetCreditsUsageQuery(
  request: NextRequest,
): Promise<string | NextResponse> {
  const parsed = querySchema.safeParse({
    accountId: request.nextUrl.searchParams.getAll("accountId"),
  });
  if (!parsed.success) return errorResponse("accountId must be a single valid UUID", 400);
  const auth = await validateAuthContext(request, {
    accountId: parsed.data.accountId[0],
    allowAccountCreation: false,
  });
  return auth instanceof NextResponse ? auth : auth.accountId;
}
