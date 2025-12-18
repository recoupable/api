import insertMemories from "@/lib/supabase/memories/insertMemories";
import filterMessageContentForMemories from "@/lib/messages/filterMessageContentForMemories";
import { UIMessage } from "ai";
import type { Tables } from "@/types/database.types";

type Memory = Tables<"memories">;

interface SaveNewMessagesParams {
  roomId: string;
  lastMessage: UIMessage;
  responseMessages: UIMessage[];
}

/**
 * Saves new messages to the database sequentially to maintain correct order.
 * First stores the user message, then the assistant message.
 *
 * @param params - The parameters for saving messages
 * @param params.roomId - The room ID
 * @param params.lastMessage - The last user message
 * @param params.responseMessages - The assistant response messages
 * @returns Array of inserted memory records
 */
export async function saveNewMessages({
  roomId,
  lastMessage,
  responseMessages,
}: SaveNewMessagesParams): Promise<Memory[]> {
  // Store messages sequentially to maintain correct order
  // First store the user message, then the assistant message
  const userMemory = await insertMemories({
    id: lastMessage.id,
    room_id: roomId,
    content: filterMessageContentForMemories(lastMessage),
  });

  const assistantMemory = await insertMemories({
    id: responseMessages[responseMessages.length - 1].id,
    room_id: roomId,
    content: filterMessageContentForMemories(responseMessages[responseMessages.length - 1]),
  });

  return [userMemory, assistantMemory].filter((m): m is Memory => m !== null);
}
