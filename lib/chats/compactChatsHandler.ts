import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateCompactChatsBody } from "./validateCompactChatsBody";
import { compactChat, CompactChatResult } from "./compactChat";
import selectRoom from "@/lib/supabase/rooms/selectRoom";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

/**
 * Handler for compacting chat conversations into summarized versions.
 *
 * Requires authentication via x-api-key header or Authorization bearer token.
 * User must have access to each chat being compacted.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with the compacted chats or an error
 */
export async function compactChatsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse and validate request body
    const body = await safeParseJson(request);
    const validated = validateCompactChatsBody(body);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { chatId: chatIds, prompt } = validated;

    // Authenticate the request
    const authResult = await validateAuthContext(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { accountId, orgId } = authResult;

    // Process all chats in parallel using Promise.all for performance
    const processResults = await Promise.all(
      chatIds.map(async chatId => {
        // Verify the chat exists
        const room = await selectRoom(chatId);
        if (!room) {
          return { type: "notFound" as const, chatId };
        }

        // Verify user has access to the chat
        const roomAccountId = room.account_id;
        if (roomAccountId && roomAccountId !== accountId) {
          // Check if org key has access to this account
          const hasAccess = await canAccessAccount({
            orgId,
            targetAccountId: roomAccountId,
          });
          if (!hasAccess) {
            return { type: "notFound" as const, chatId };
          }
        }

        // Compact the chat
        const compactResult = await compactChat(chatId, prompt);
        return { type: "success" as const, result: compactResult };
      }),
    );

    // Separate results and not-found IDs
    const results: CompactChatResult[] = [];
    const notFoundIds: string[] = [];

    for (const processResult of processResults) {
      if (processResult.type === "notFound") {
        notFoundIds.push(processResult.chatId);
      } else if (processResult.result) {
        results.push(processResult.result);
      }
    }

    // If any chats were not found or not accessible, return 404
    if (notFoundIds.length > 0) {
      return NextResponse.json(
        {
          error: 404,
          message: `Chat(s) not found or not accessible: ${notFoundIds.join(", ")}`,
        },
        {
          status: 404,
          headers: getCorsHeaders(),
        },
      );
    }

    return NextResponse.json(
      {
        chats: results,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] compactChatsHandler:", error);
    return NextResponse.json(
      {
        error: 500,
        message: error instanceof Error ? error.message : "Internal server error",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
