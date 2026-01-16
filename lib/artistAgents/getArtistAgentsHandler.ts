import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { getAuthenticatedAccountId } from "@/lib/auth/getAuthenticatedAccountId";
import { getArtistAgents } from "./getArtistAgents";

/**
 * Handler for fetching artist agents by social IDs.
 *
 * Requires authentication via x-api-key header OR Authorization Bearer token.
 * Exactly one authentication mechanism must be provided.
 *
 * Query parameters:
 * - socialId: One or more social IDs (can be repeated)
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with the agents array or an error
 */
export async function getArtistAgentsHandler(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    // Check which auth mechanism is provided
    const apiKey = request.headers.get("x-api-key");
    const authHeader = request.headers.get("authorization");
    const hasApiKey = !!apiKey;
    const hasAuth = !!authHeader;

    // Enforce that exactly one auth mechanism is provided
    if ((hasApiKey && hasAuth) || (!hasApiKey && !hasAuth)) {
      return NextResponse.json(
        {
          status: "error",
          message: "Exactly one of x-api-key or Authorization must be provided",
        },
        {
          status: 401,
          headers: getCorsHeaders(),
        },
      );
    }

    // Authenticate
    if (hasApiKey) {
      const accountIdOrError = await getApiKeyAccountId(request);
      if (accountIdOrError instanceof NextResponse) {
        return accountIdOrError;
      }
      // accountId validated but not used - just ensuring auth
    } else {
      const accountIdOrError = await getAuthenticatedAccountId(request);
      if (accountIdOrError instanceof NextResponse) {
        return accountIdOrError;
      }
      // accountId validated but not used - just ensuring auth
    }

    // Parse socialId query parameters
    const { searchParams } = new URL(request.url);
    const socialIds = searchParams.getAll("socialId");

    if (!socialIds.length) {
      return NextResponse.json(
        {
          status: "error",
          message: "At least one socialId is required",
        },
        {
          status: 400,
          headers: getCorsHeaders(),
        },
      );
    }

    const agents = await getArtistAgents(socialIds);

    return NextResponse.json(
      {
        status: "success",
        agents,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] getArtistAgentsHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to fetch artist agents",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
