import { NextRequest, NextResponse } from "next/server";
import refreshConnectedAccount from "@/lib/composio/googleSheets/refreshConnectedAccount";
import { createApiResponse } from "@/lib/networking/createApiResponse";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * POST handler for refreshing a connected account.
 *
 * @param request - The request object.
 * @returns A NextResponse with the refreshed connected account.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, redirectUrl } = body;

    if (!accountId) {
      return createApiResponse({ error: "accountId is required" }, 400);
    }

    const response = await refreshConnectedAccount(accountId, redirectUrl);

    return createApiResponse(
      { message: "Connected account refreshed successfully", ...response },
      200,
    );
  } catch (error) {
    console.error("Error refreshing connected account:", error);

    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    const statusCode = errorMessage.includes("not found") ? 404 : 500;

    return createApiResponse({ error: errorMessage }, statusCode);
  }
}
