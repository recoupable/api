import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";
import { z } from "zod";
import { adminPeriodSchema, type AdminPeriod } from "@/lib/admins/adminPeriod";

const getAgentSignupsQuerySchema = z.object({
  period: adminPeriodSchema.default("all"),
});

export type GetAgentSignupsQuery = {
  period: AdminPeriod;
};

/**
 * Validates admin auth and query parameters for GET /api/admins/agent-signups.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or the validated query
 */
export async function validateGetAgentSignupsQuery(
  request: NextRequest,
): Promise<NextResponse | GetAgentSignupsQuery> {
  const auth = await validateAdminAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const period = request.nextUrl.searchParams.get("period") || undefined;

  const result = getAgentSignupsQuerySchema.safeParse({ period });

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      { status: "error", error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return { period: result.data.period };
}
