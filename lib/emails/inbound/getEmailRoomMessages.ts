import type { ModelMessage } from "ai";
import selectMemories from "@/lib/supabase/memories/selectMemories";

/**
 * Builds a messages array for agent.generate, including conversation history if roomId exists.
 *
 * @param roomId - Optional room ID to fetch existing conversation history
 * @returns Array of ModelMessage objects with conversation history
 */
export async function getEmailRoomMessages(roomId: string): Promise<ModelMessage[]> {
  let messages: ModelMessage[] = [];

  const existingMemories = await selectMemories(roomId, { ascending: true });
  if (existingMemories) {
    messages = existingMemories.map(memory => {
      const content = memory.content as { role: string; parts: unknown[] };
      return {
        role: content.role as "user" | "assistant" | "system",
        content: content.parts,
      } as ModelMessage;
    });
  }

  return messages;
}
