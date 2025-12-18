import { validateMessages } from "@/lib/messages/validateMessages";
import selectRoom from "@/lib/supabase/rooms/selectRoom";
import { ChatRequestBody } from "./validateChatRequest";
import { UIMessage } from "ai";
import { generateUUID } from "@/lib/uuid/generateUUID";
import { createNewRoom } from "@/lib/chat/createNewRoom";
import { saveNewMessages } from "@/lib/chat/saveNewMessages";

/**
 * Handles the chat completion and saves the messages to the database.
 *
 * @param body - The chat request body
 * @param responseMessages - The response messages
 * @returns void
 */
export async function handleChatCompletion(
  body: ChatRequestBody,
  responseMessages: UIMessage[],
): Promise<void> {
  const { messages, roomId = generateUUID(), accountId, artistId } = body;

  const { lastMessage } = validateMessages(messages);

  const room = await selectRoom(roomId);

  // Create room and send notification if this is a new conversation
  if (!room) {
    await createNewRoom({
      accountId,
      roomId,
      artistId,
      lastMessage,
    });
  }

  await saveNewMessages({
    roomId,
    lastMessage,
    responseMessages,
  });
}
