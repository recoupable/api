import type { ModelMessage } from "ai";
import selectMemories from "@/lib/supabase/memories/selectMemories";

/**
 * Builds a messages array for agent.generate, including conversation history if roomId exists.
 *
 * @param roomId - Optional room ID to fetch existing conversation history
 * @param emailText - The current email text to add as a user message
 * @returns Array of ModelMessage objects with conversation history and current message
 */
export async function getEmailRoomMessages(
  roomId: string | undefined,
  emailText: string,
): Promise<ModelMessage[]> {
  let messages: ModelMessage[] = [];

  if (roomId) {
    const existingMemories = await selectMemories(roomId);
    if (existingMemories) {
      messages = existingMemories.map(memory => {
        const content = memory.content as { role: string; parts: unknown[] };
        return {
          role: content.role as "user" | "assistant" | "system",
          content: content.parts,
        } as ModelMessage;
      });
    }
  }

  // Add the current email message
  messages.push({
    role: "user",
    content: [{ type: "text", text: emailText }],
  } as ModelMessage);

  return messages;
}
