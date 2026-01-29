import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCompactChatsRequest } from "./validateCompactChatsRequest";
import { processCompactChatRequest } from "./processCompactChatRequest";
import type { CompactChatResult } from "./compactChat";

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
    // Validate request (body parsing, schema validation, and authentication)
    const validated = await validateCompactChatsRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { chatIds, prompt, accountId, orgId } = validated;

    // Process all chats in parallel using Promise.all for performance
    const processResults = await Promise.all(
      chatIds.map(chatId =>
        processCompactChatRequest({ chatId, prompt, accountId, orgId }),
      ),
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
