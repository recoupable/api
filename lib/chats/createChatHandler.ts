import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { validateOverrideAccountId } from "@/lib/accounts/validateOverrideAccountId";
import { upsertRoom } from "@/lib/supabase/rooms/upsertRoom";
import { generateUUID } from "@/lib/uuid/generateUUID";
import { validateCreateChatBody } from "@/lib/chats/validateCreateChatBody";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { generateChatTitle } from "@/lib/chats/generateChatTitle";

/**
 * Handler for creating a new chat room.
 *
 * Requires authentication via x-api-key header.
 * The account ID is inferred from the API key, unless an accountId is provided
 * in the request body by an organization API key with access to that account.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with the created chat or an error
 */
export async function createChatHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const accountIdOrError = await getApiKeyAccountId(request);
    if (accountIdOrError instanceof NextResponse) {
      return accountIdOrError;
    }

    let accountId = accountIdOrError;

    const body = await safeParseJson(request);

    const validated = validateCreateChatBody(body);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const {
      artistId,
      chatId,
      accountId: bodyAccountId,
      firstMessage,
      topic: providedTopic,
    } = validated;

    // Handle accountId override for org API keys
    if (bodyAccountId) {
      const validated = await validateOverrideAccountId({
        apiKey: request.headers.get("x-api-key"),
        targetAccountId: bodyAccountId,
      });
      if (validated instanceof NextResponse) {
        return validated;
      }
      accountId = validated.accountId;
    }

    const roomId = chatId || generateUUID();

    // Use provided topic, or generate from firstMessage if provided
    let topic: string | null = providedTopic || null;
    if (!topic && firstMessage) {
      try {
        topic = await generateChatTitle(firstMessage);
      } catch {
        // Silently fall back to null topic on generation failure
      }
    }

    const chat = await upsertRoom({
      id: roomId,
      account_id: accountId,
      artist_id: artistId || null,
      topic,
    });

    return NextResponse.json(
      {
        status: "success",
        chat,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] createChatHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to create chat",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
