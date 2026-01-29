import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkAccountArtistAccess } from "@/lib/supabase/account_artist_ids/checkAccountArtistAccess";
import { validateCompleteArtistConnectorBody } from "@/lib/composio/artistConnectors/validateCompleteArtistConnectorBody";
import { completeArtistConnector } from "@/lib/composio/artistConnectors/completeArtistConnector";
import { isAllowedArtistConnector } from "@/lib/composio/artistConnectors/ALLOWED_ARTIST_CONNECTORS";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns Empty response with CORS headers
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * POST /api/artist-connectors/complete
 *
 * Complete the OAuth flow for an artist connector.
 * Queries Composio for the latest connection and stores it in the database.
 *
 * Authentication: x-api-key OR Authorization Bearer token required.
 *
 * Request body:
 * - artist_id: The artist ID to associate the connection with (required)
 * - toolkit_slug: The toolkit slug, e.g., "tiktok" (required)
 *
 * @param request - The incoming request
 * @returns Success status and connected account ID
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const headers = getCorsHeaders();

  try {
    // Validate auth
    const authResult = await validateAuthContext(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { accountId } = authResult;

    // Parse and validate body
    const body = await request.json();
    const validated = validateCompleteArtistConnectorBody(body);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { artist_id, toolkit_slug } = validated;

    // Verify toolkit is allowed
    if (!isAllowedArtistConnector(toolkit_slug)) {
      return NextResponse.json(
        { error: `Toolkit '${toolkit_slug}' is not allowed for artist connections` },
        { status: 400, headers },
      );
    }

    // Verify user has access to this artist
    const hasAccess = await checkAccountArtistAccess(accountId, artist_id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied to this artist" },
        { status: 403, headers },
      );
    }

    // Complete the OAuth flow
    const result = await completeArtistConnector(accountId, artist_id, toolkit_slug);

    return NextResponse.json(
      {
        success: true,
        data: {
          connectedAccountId: result.connectedAccountId,
        },
      },
      { status: 200, headers },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to complete artist connector";
    return NextResponse.json({ error: message }, { status: 500, headers });
  }
}
