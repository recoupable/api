import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateDeleteApiKeyBody } from "@/lib/keys/validateDeleteApiKeyBody";
import { deleteApiKey } from "@/lib/supabase/account_api_keys/deleteApiKey";
import { getAuthenticatedAccountId } from "@/lib/auth/getAuthenticatedAccountId";
import { getApiKeys } from "@/lib/supabase/account_api_keys/getApiKeys";

/**
 * Handler for deleting an API key.
 * Requires authentication via Bearer token in Authorization header.
 * Only allows deleting API keys that belong to the authenticated account.
 *
 * Body parameters:
 * - id (required): The ID of the API key to delete
 *
 * @param request - The request object containing the body with id.
 * @returns A NextResponse with the delete operation status.
 */
export async function deleteApiKeyHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const accountIdOrError = await getAuthenticatedAccountId(request);
    if (accountIdOrError instanceof NextResponse) {
      return accountIdOrError;
    }
    const accountId = accountIdOrError;

    const body = await request.json();

    const validatedBody = validateDeleteApiKeyBody(body);
    if (validatedBody instanceof NextResponse) {
      return validatedBody;
    }

    // Fetch the API key by ID
    const { data: apiKeys, error: fetchError } = await getApiKeys({ id: validatedBody.id });

    if (fetchError || !apiKeys || apiKeys.length === 0) {
      return NextResponse.json(
        {
          status: "error",
          message: "API key not found",
        },
        {
          status: 404,
          headers: getCorsHeaders(),
        },
      );
    }

    const key = apiKeys[0];

    // Check if the key belongs to the authenticated account
    if (key.account !== accountId) {
      return NextResponse.json(
        {
          status: "error",
          message: "Access denied",
        },
        {
          status: 404,
          headers: getCorsHeaders(),
        },
      );
    }

    const { error } = await deleteApiKey(validatedBody.id);

    if (error) {
      console.error("Error deleting API key:", error);
      return NextResponse.json(
        {
          status: "error",
          message: "Failed to delete API key",
        },
        {
          status: 500,
          headers: getCorsHeaders(),
        },
      );
    }

    return NextResponse.json(
      {
        status: "success",
        message: "API key deleted successfully",
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] Error deleting API key:", error);
    const message = error instanceof Error ? error.message : "Failed to delete API key";
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
