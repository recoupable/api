import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getApiKeys } from "@/lib/supabase/account_api_keys/getApiKeys";
import { getAuthenticatedAccountId } from "@/lib/auth/getAuthenticatedAccountId";
import { getOrgApiKeysHandler } from "@/lib/keys/org/getOrgApiKeysHandler";

/**
 * Handler for retrieving API keys for an account or organization.
 * Requires authentication via Bearer token in Authorization header.
 *
 * Optional query parameter:
 * - organizationId: If provided, returns keys for the organization
 *   after validating the authenticated account is a member.
 *
 * @param request - The request object.
 * @returns A NextResponse with the API keys.
 */
export async function getApiKeysHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId") ?? undefined;

    const accountIdOrError = await getAuthenticatedAccountId(request);
    if (accountIdOrError instanceof NextResponse) {
      return accountIdOrError;
    }
    const accountId = accountIdOrError;

    // If organizationId is provided, delegate to org-specific handler
    if (organizationId) {
      return getOrgApiKeysHandler(accountId, organizationId);
    }

    // Default: fetch keys for the authenticated account
    const { data, error } = await getApiKeys({ accountId });

    if (error) {
      console.error("Error fetching API keys:", error);
      return NextResponse.json(
        {
          status: "error",
          message: "Failed to fetch API keys",
        },
        {
          status: 500,
          headers: getCorsHeaders(),
        },
      );
    }

    return NextResponse.json(
      {
        keys: data || [],
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] Error fetching API keys:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch API keys";
    return NextResponse.json(
      {
        status: "error",
        message,
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
