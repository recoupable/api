import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";
import { adminPeriodSchema } from "@/lib/admins/adminPeriod";

const querySchema = z.object({ period: adminPeriodSchema.default("all") });
type AgentSignupsQuery = z.infer<typeof querySchema>;

/**
 * Validates admin access before parsing the report's optional period.
 *
 * @param request - Request carrying admin authentication and optional period.
 * @returns The period, or the existing auth/validation error response.
 */
export async function validateGetAgentSignupsQuery(
  request: NextRequest,
): Promise<NextResponse | AgentSignupsQuery> {
  const auth = await validateAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  const result = querySchema.safeParse({
    period: request.nextUrl.searchParams.get("period") ?? undefined,
  });
  if (!result.success) {
    return NextResponse.json(
      { status: "error", error: result.error.issues[0].message },
      { status: 400, headers: getCorsHeaders() },
    );
  }
  return result.data;
}
