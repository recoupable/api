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
 * `sessionId` and the owning `accountId` per row, enabling clients to render
 * canonical `/sessions/{sid}/chats/{cid}` URLs.
 *
 * Scope:
 * - Personal/org key: chats belonging to the caller's account.
 * - Personal/org key with `account_id`: chats for that account (when the
 *   caller can access it).
 * - Recoup admin: all chats (or a specific account when `account_id` is set).
 *
 * Optional query parameters:
 * - `account_id`: target account override (validated against access).
 * - `artist_account_id`: accepted for backward-compat, but not used as a
 *   filter (reserved for the artist-surface migration).
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

    const rows = await selectChatsWithSessions({ accountIds: validated.accountIds });

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
        },
      ];
    });

    return NextResponse.json(
      { status: "success", chats },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] getChatsHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
