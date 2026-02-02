import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import type { SelectAccountSandboxesParams } from "@/lib/supabase/account_sandboxes/selectAccountSandboxes";
import { z } from "zod";

const getSandboxesQuerySchema = z.object({
  sandbox_id: z.string().optional(),
});

/**
 * Validates GET /api/sandboxes request.
 * Handles authentication via x-api-key or Authorization bearer token.
 *
 * Query parameters:
 * - sandbox_id: Filter to a specific sandbox (must belong to account/org)
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or SelectAccountSandboxesParams
 */
export async function validateGetSandboxesRequest(
  request: NextRequest,
): Promise<NextResponse | SelectAccountSandboxesParams> {
  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const queryParams = {
    sandbox_id: searchParams.get("sandbox_id") ?? undefined,
  };

  const queryResult = getSandboxesQuerySchema.safeParse(queryParams);
  if (!queryResult.success) {
    const firstError = queryResult.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const { sandbox_id: sandboxId } = queryResult.data;

  // Use validateAuthContext for authentication
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { accountId, orgId } = authResult;

  // Build params based on auth context
  const params: SelectAccountSandboxesParams = {
    sandboxId,
  };

  if (orgId) {
    // Org key - filter by org membership
    params.orgId = orgId;
  } else {
    // Personal key - filter by account
    params.accountIds = [accountId];
  }

  return params;
}
