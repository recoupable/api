import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/networking/errorResponse";
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
    return errorResponse(result.error.issues[0].message, 400);
  }
  return result.data;
}
