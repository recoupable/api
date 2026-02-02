import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetChatsRequest } from "@/lib/chats/validateGetChatsRequest";
import { selectRooms } from "@/lib/supabase/rooms/selectRooms";

/**
 * Handler for retrieving chats.
 * Requires authentication via x-api-key header or Authorization bearer token.
 *
 * For personal keys: Returns array of chats for the account (if exists).
 * For org keys: Returns array of chats for accounts in the organization.
 * For Recoup admin key: Returns array of ALL chat records.
 *
 * Optional query parameters:
 * - account_id: Filter to a specific account (validated against org membership)
 * - artist_account_id: Filter to chats for a specific artist (UUID)
 *
 * @param request - The request object containing query parameters
 * @returns A NextResponse with chats data
 */
export async function getChatsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetChatsRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    // Pass validated params directly to selectRooms
    const chats = await selectRooms(validated);

    if (chats === null) {
      return NextResponse.json(
        {
          status: "error",
          error: "Failed to retrieve chats",
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
        chats,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] getChatsHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Internal server error",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
