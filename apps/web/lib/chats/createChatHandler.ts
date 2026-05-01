import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { upsertRoom } from "@/lib/supabase/rooms/upsertRoom";
import { generateUUID } from "@/lib/uuid/generateUUID";
import { validateCreateChatBody } from "@/lib/chats/validateCreateChatBody";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { generateChatTitle } from "@/lib/chats/generateChatTitle";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { sendNewConversationNotification } from "@/lib/telegram/sendNewConversationNotification";

/**
 * Handler for creating a new chat room.
 *
 * Requires authentication via x-api-key header or Authorization bearer token.
 * The account ID is inferred from the auth context, unless an accountId is provided
 * in the request body and the authenticated account is allowed to act on behalf of it.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with the created chat or an error
 */
export async function createChatHandler(request: NextRequest): Promise<NextResponse> {
  try {
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

    const authResult = await validateAuthContext(request, {
      accountId: bodyAccountId,
    });
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { accountId } = authResult;

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

    try {
      const accountEmails = await selectAccountEmails({ accountIds: accountId });
      const email = accountEmails[0]?.email || "";

      await sendNewConversationNotification({
        accountId,
        email,
        conversationId: chat.id,
        topic: chat.topic || "",
        firstMessage,
      });
    } catch (notificationError) {
      console.error("[ERROR] createChatHandler notification:", notificationError);
    }

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
