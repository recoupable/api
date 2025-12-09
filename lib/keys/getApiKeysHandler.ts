import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetApiKeysQuery } from "@/lib/keys/validateGetApiKeysQuery";
import { getApiKeys } from "@/lib/supabase/account_api_keys/getApiKeys";

/**
 * Handler for retrieving API keys for an account.
 *
 * Query parameters:
 * - account_id (required): The account ID to retrieve API keys for
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with the API keys.
 */
export async function getApiKeysHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const validatedQuery = validateGetApiKeysQuery(searchParams);
    if (validatedQuery instanceof NextResponse) {
      return validatedQuery;
    }

    const { data, error } = await getApiKeys(validatedQuery.account_id);

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
