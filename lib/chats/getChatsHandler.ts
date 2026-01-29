import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateGetChatsQuery } from "@/lib/chats/validateGetChatsQuery";
import { selectRoomsByAccountId } from "@/lib/supabase/rooms/selectRoomsByAccountId";

/**
 * Handler for retrieving chats.
 *
 * Query parameters:
 * - account_id (required): The account's ID (UUID)
 * - artist_account_id (optional): Filter to chats for a specific artist (UUID)
 *
 * @param request - The request object containing query parameters
 * @returns A NextResponse with chats data
 */
export async function getChatsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await validateAuthContext(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);

    const validatedQuery = validateGetChatsQuery(searchParams);
    if (validatedQuery instanceof NextResponse) {
      return validatedQuery;
    }

    const { account_id, artist_account_id } = validatedQuery;

    const chats = await selectRoomsByAccountId({
      accountId: account_id,
      artistId: artist_account_id,
    });

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
