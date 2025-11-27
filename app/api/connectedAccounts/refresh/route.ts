import { NextRequest, NextResponse } from "next/server";
import refreshConnectedAccount from "@/lib/composio/googleSheets/refreshConnectedAccount";
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
      return NextResponse.json(
        { error: "accountId is required" },
        {
          status: 400,
          headers: getCorsHeaders(),
        },
      );
    }

    const response = await refreshConnectedAccount(accountId, redirectUrl);

    return NextResponse.json(
      { message: "Connected account refreshed successfully", ...response },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("Error refreshing connected account:", error);

    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    const statusCode = errorMessage.includes("not found") ? 404 : 500;

    return NextResponse.json(
      { error: errorMessage },
      {
        status: statusCode,
        headers: getCorsHeaders(),
      },
    );
  }
}
