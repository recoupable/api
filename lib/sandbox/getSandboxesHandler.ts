import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetSandboxesRequest } from "./validateGetSandboxesRequest";
import { selectAccountSandboxes } from "@/lib/supabase/account_sandboxes/selectAccountSandboxes";
import { getSandboxStatus } from "./getSandboxStatus";
import type { SandboxCreatedResponse } from "./createSandbox";

/**
 * Handler for retrieving sandbox statuses for an account.
 * Requires authentication via x-api-key header or Authorization bearer token.
 *
 * For personal keys: Returns sandboxes for the key owner's account.
 * For org keys: Returns sandboxes for all accounts in the organization.
 *
 * Optional query parameters:
 * - sandbox_id: Filter to a specific sandbox (must belong to account/org)
 *
 * @param request - The request object.
 * @returns A NextResponse with array of sandbox statuses.
 */
export async function getSandboxesHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateGetSandboxesRequest(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  // Get sandbox records from database
  const accountSandboxes = await selectAccountSandboxes(validated);

  // Fetch live status for each sandbox from Vercel API in parallel
  const statusResults = await Promise.all(
    accountSandboxes.map(record => getSandboxStatus(record.sandbox_id)),
  );

  // Filter out null results (sandboxes that no longer exist)
  const sandboxes = statusResults.filter(
    (status): status is SandboxCreatedResponse => status !== null,
  );

  return NextResponse.json(
    {
      status: "success",
      sandboxes,
    },
    {
      status: 200,
      headers: getCorsHeaders(),
    },
  );
}
