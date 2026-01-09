import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { insertRoom } from "@/lib/supabase/rooms/insertRoom";
import { generateUUID } from "@/lib/uuid/generateUUID";
import { validateCreateChatBody } from "@/lib/chats/validateCreateChatBody";
import { safeParseJson } from "@/lib/networking/safeParseJson";

/**
 * Handler for creating a new chat room.
 *
 * Requires authentication via x-api-key header.
 * The account ID is inferred from the API key.
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

    const accountId = accountIdOrError;

    const body = await safeParseJson(request);

    const validated = validateCreateChatBody(body);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { artistId, chatId } = validated;

    const roomId = chatId || generateUUID();

    const chat = await insertRoom({
      id: roomId,
      account_id: accountId,
      artist_id: artistId || null,
      topic: null,
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
