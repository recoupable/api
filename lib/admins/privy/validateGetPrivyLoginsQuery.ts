import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";
import { z } from "zod";
import { privyLoginsPeriodSchema, type PrivyLoginsPeriod } from "./privyLoginsPeriod";

const getPrivyLoginsQuerySchema = z.object({
  period: privyLoginsPeriodSchema.default("all"),
});

export type GetPrivyLoginsQuery = {
  period: PrivyLoginsPeriod;
};

/**
 * Validates admin auth and query parameters for GET /api/admins/privy.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or the validated query
 */
export async function validateGetPrivyLoginsQuery(
  request: NextRequest,
): Promise<NextResponse | GetPrivyLoginsQuery> {
  const auth = await validateAdminAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const period = request.nextUrl.searchParams.get("period") || undefined;

  const result = getPrivyLoginsQuerySchema.safeParse({ period });

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      { status: "error", error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return { period: result.data.period };
}
