import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetChatsRequest } from "@/lib/chats/validateGetChatsRequest";
import { selectChatsWithSessions } from "@/lib/supabase/chats/selectChatsWithSessions";

/**
 * Handler for retrieving chats.
 *
 * Requires authentication via x-api-key header or Authorization bearer token.
 *
 * Returns chats joined with their owning session so the response carries the
 * `sessionId`, owning `accountId`, and `artistId` per row, enabling clients
 * to render canonical `/sessions/{sid}/chats/{cid}` URLs and filter by
 * artist context. Chats whose owning session is archived
 * (`sessions.status === "archived"`) are excluded — archive is the
 * soft-delete path for sessions.
 *
 * Scope:
 * - Personal/org key: chats belonging to the caller's account.
 * - Personal/org key with `account_id`: chats for that account (when the
 *   caller can access it).
 * - Recoup admin: all chats (or a specific account when `account_id` is set).
 *
 * Optional query parameters:
 * - `account_id`: target account override (validated against access).
 * - `artist_account_id`: scope chats to those whose owning session has the
 *   given artist context (`sessions.artist_id`). Composes with `account_id`.
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

    const rows = await selectChatsWithSessions({
      accountIds: validated.accountIds,
      artistAccountId: validated.artistAccountId,
    });

    if (rows === null) {
      return NextResponse.json(
        { status: "error", error: "Failed to retrieve chats" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    const chats = rows.flatMap(row => {
      if (!row.session) return [];
      return [
        {
          id: row.id,
          title: row.title,
          accountId: row.session.account_id,
          sessionId: row.session_id,
          updatedAt: row.updated_at,
          artistId: row.session.artist_id,
        },
      ];
    });

    return NextResponse.json(
      { status: "success", chats },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    // Never leak raw exception messages on 500 — they can expose internal
    // structure or DB errors. Caller gets a fixed string; the real cause
    // stays in server logs.
    console.error("[ERROR] getChatsHandler:", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
