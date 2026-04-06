import { getToolOrDynamicToolName, isToolOrDynamicToolUIPart, type UIMessage } from "ai";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import selectRoom from "@/lib/supabase/rooms/selectRoom";
import { upsertRoom } from "@/lib/supabase/rooms/upsertRoom";
import upsertMemory from "@/lib/supabase/memories/upsertMemory";
import { validateMessages } from "@/lib/messages/validateMessages";
import { generateChatTitle } from "@/lib/chat/generateChatTitle";
import { sendNewConversationNotification } from "@/lib/telegram/sendNewConversationNotification";
import filterMessageContentForMemories from "@/lib/messages/filterMessageContentForMemories";
import { handleSendEmailToolOutputs } from "@/lib/emails/handleSendEmailToolOutputs";
import { sendErrorNotification } from "@/lib/telegram/sendErrorNotification";
import { serializeError } from "@/lib/errors/serializeError";
import type { ChatRequestBody } from "./validateChatRequest";
import { copyRoom } from "@/lib/rooms/copyRoom";
import type { CreateNewArtistResult } from "@/lib/mcp/tools/artists/registerCreateNewArtistTool";
import { copyChatMessages } from "@/lib/chats/copyChatMessages";

export interface ChatCompletionResult {
  redirectPath?: string;
}

function getCreateArtistResult(responseMessages: UIMessage[]): CreateNewArtistResult | null {
  for (const message of responseMessages) {
    for (const part of message.parts) {
      if (!isToolOrDynamicToolUIPart(part)) continue;
      if (getToolOrDynamicToolName(part) !== "create_new_artist") continue;
      if (part.state !== "output-available") continue;

      if (part.type === "dynamic-tool") {
        const text = (part.output as { content?: Array<{ text?: string }> } | undefined)
          ?.content?.[0]?.text;
        if (!text) continue;

        try {
          return JSON.parse(text) as CreateNewArtistResult;
        } catch {
          continue;
        }
      }

      return part.output as CreateNewArtistResult;
    }
  }

  return null;
}

/**
 * Handles post-chat-completion tasks:
 * - Creates room if this is a new conversation
 * - Sends notification for new conversations
 * - Stores user and assistant messages to memories
 * - Processes email tool outputs
 *
 * Errors are caught and sent to Telegram but do not propagate
 * to avoid breaking the chat response.
 *
 * @param body - The validated chat request body
 * @param responseMessages - The assistant response messages
 */
export async function handleChatCompletion(
  body: ChatRequestBody,
  responseMessages: UIMessage[],
): Promise<ChatCompletionResult> {
  try {
    const { messages, roomId = "", accountId, artistId } = body;

    // Get account email
    let email = "";
    const emails = await selectAccountEmails({ accountIds: accountId });
    if (emails.length > 0 && emails[0].email) {
      email = emails[0].email;
    }

    // Validate and get last user message
    const { lastMessage } = validateMessages(messages);

    // Check if room exists
    const room = await selectRoom(roomId);

    // Create room and send notification if this is a new conversation
    if (!room) {
      const latestMessageText = lastMessage.parts.find(part => part.type === "text")?.text || "";
      const conversationName = await generateChatTitle(latestMessageText);

      await Promise.all([
        upsertRoom({
          id: roomId,
          account_id: accountId,
          topic: conversationName,
          artist_id: artistId || null,
        }),
        sendNewConversationNotification({
          accountId,
          email,
          conversationId: roomId,
          topic: conversationName,
          firstMessage: latestMessageText,
        }),
      ]);
    }

    // Store messages sequentially to maintain correct order
    // First store the user message, then the assistant message
    await upsertMemory({
      id: lastMessage.id,
      room_id: roomId,
      content: filterMessageContentForMemories(lastMessage),
    });

    await upsertMemory({
      id: responseMessages[responseMessages.length - 1].id,
      room_id: roomId,
      content: filterMessageContentForMemories(responseMessages[responseMessages.length - 1]),
    });

    let redirectPath: string | undefined;
    const createArtistResult = getCreateArtistResult(responseMessages);
    if (createArtistResult?.artistAccountId) {
      const newRoomId = await copyRoom(roomId, createArtistResult.artistAccountId);

      if (newRoomId) {
        const copyResult = await copyChatMessages({
          sourceChatId: roomId,
          targetChatId: newRoomId,
          clearExisting: true,
        });

        if (copyResult.status === "success") {
          redirectPath = `/chat/${newRoomId}`;
        } else {
          console.error(copyResult.error);
        }
      } else {
        console.error("Failed to create final artist conversation room");
      }
    }

    // Process any email tool outputs
    await handleSendEmailToolOutputs(responseMessages);

    return { redirectPath };
  } catch (error) {
    sendErrorNotification({
      ...body,
      path: "/api/chat",
      error: serializeError(error),
    });
    console.error("Failed to save chat", error);
    return {};
  }
}
