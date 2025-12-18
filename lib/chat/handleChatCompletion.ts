import { validateMessages } from "@/lib/messages/validateMessages";
import selectRoom from "@/lib/supabase/rooms/selectRoom";
import { ChatRequestBody } from "./validateChatRequest";
import { UIMessage } from "ai";
import { generateUUID } from "@/lib/uuid/generateUUID";
import { createNewRoom } from "@/lib/chat/createNewRoom";
import { saveNewMessages } from "@/lib/chat/saveNewMessages";
import type { Tables } from "@/types/database.types";

type Memory = Tables<"memories">;

/**
 * Handles the chat completion and saves the messages to the database.
 *
 * @param body - The chat request body
 * @param responseMessages - The response messages
 * @returns Array of inserted memory records
 */
export async function handleChatCompletion(
  body: ChatRequestBody,
  responseMessages: UIMessage[],
): Promise<Memory[]> {
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

  const memories = await saveNewMessages({
    roomId,
    lastMessage,
    responseMessages,
  });

  return memories;
}
