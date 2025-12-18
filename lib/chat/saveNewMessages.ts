import insertMemories from "@/lib/supabase/memories/insertMemories";
import filterMessageContentForMemories from "@/lib/messages/filterMessageContentForMemories";
import { UIMessage } from "ai";

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
 * @returns void
 */
export async function saveNewMessages({
  roomId,
  lastMessage,
  responseMessages,
}: SaveNewMessagesParams): Promise<void> {
  // Store messages sequentially to maintain correct order
  // First store the user message, then the assistant message
  await insertMemories({
    id: lastMessage.id,
    room_id: roomId,
    content: filterMessageContentForMemories(lastMessage),
  });

  await insertMemories({
    id: responseMessages[responseMessages.length - 1].id,
    room_id: roomId,
    content: filterMessageContentForMemories(responseMessages[responseMessages.length - 1]),
  });
}
