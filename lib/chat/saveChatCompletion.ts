import { getMessages } from "@/lib/messages/getMessages";
import filterMessageContentForMemories from "@/lib/messages/filterMessageContentForMemories";
import insertMemories from "@/lib/supabase/memories/insertMemories";
import type { Tables } from "@/types/database.types";

type Memory = Tables<"memories">;

interface SaveChatCompletionParams {
  text: string;
  roomId: string;
  role?: "user" | "assistant";
}

/**
 * Saves a chat completion message to the database.
 *
 * This utility encapsulates the three-step process of:
 * 1. Converting text to a UIMessage using getMessages
 * 2. Filtering message content for storage using filterMessageContentForMemories
 * 3. Inserting the memory using insertMemories
 *
 * @param params - The parameters for saving the chat completion
 * @param params.text - The text content of the message
 * @param params.roomId - The ID of the room to save the message to
 * @param params.role - The role of the message sender (defaults to "assistant")
 * @returns The inserted memory, or null if the insert fails
 */
export async function saveChatCompletion({
  text,
  roomId,
  role = "assistant",
}: SaveChatCompletionParams): Promise<Memory | null> {
  const message = getMessages(text, role)[0];
  const content = filterMessageContentForMemories(message);

  return insertMemories({
    id: message.id,
    room_id: roomId,
    content,
  });
}
