import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCreateApiKeyBody } from "@/lib/keys/validateCreateApiKeyBody";
import { getAuthenticatedAccountId } from "@/lib/auth/getAuthenticatedAccountId";
import { createOrgApiKeysHandler } from "@/lib/keys/org/createOrgApiKeysHandler";
import { createKey } from "@/lib/keys/createKey";

/**
 * Handler for creating a new API key.
 * Requires authentication via Bearer token in Authorization header.
 *
 * Body parameters:
 * - key_name (required): The name for the API key
 * - organizationId (optional): If provided, creates a key for the organization
 *   after validating the authenticated account is a member.
 *
 * @param request - The request object containing the body with key_name.
 * @returns A NextResponse with the generated API key.
 */
export async function createApiKeyHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const accountIdOrError = await getAuthenticatedAccountId(request);
    if (accountIdOrError instanceof NextResponse) {
      return accountIdOrError;
    }
    const accountId = accountIdOrError;

    const body = await request.json();

    const validatedBody = validateCreateApiKeyBody(body);
    if (validatedBody instanceof NextResponse) {
      return validatedBody;
    }

    const { key_name, organizationId } = validatedBody;

    // If organizationId is provided, delegate to org-specific handler
    if (organizationId) {
      return createOrgApiKeysHandler(accountId, organizationId, key_name);
    }

    // Default: create key for the authenticated account
    return createKey(accountId, key_name);
  } catch (error) {
    console.error("[ERROR] Error creating API key:", error);
    const message = error instanceof Error ? error.message : "Failed to create an API key";
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
