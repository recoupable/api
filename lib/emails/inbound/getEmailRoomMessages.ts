import type { ModelMessage } from "ai";
import selectMemories from "@/lib/supabase/memories/selectMemories";
import { extractTextFromParts } from "./extractTextFromParts";

interface MemoryContent {
  role: string;
  parts: { type: string; text?: string }[];
}

/**
 * Builds a messages array for agent.generate, including conversation history if roomId exists.
 * Converts UI parts to simple text-based ModelMessages for compatibility.
 *
 * @param roomId - Optional room ID to fetch existing conversation history
 * @returns Array of ModelMessage objects with conversation history
 */
export async function getEmailRoomMessages(roomId: string): Promise<ModelMessage[]> {
  const existingMemories = await selectMemories(roomId, { ascending: true });
  if (!existingMemories) return [];

  const messages: ModelMessage[] = [];

  for (const memory of existingMemories) {
    const content = memory.content as unknown as MemoryContent;
    if (!content?.role || !content?.parts) continue;

    const role = content.role;
    let text = "";

    if (role === "user" || role === "assistant") {
      text = extractTextFromParts(content.parts);
      if (text) {
        messages.push({ role, content: text });
      }
    }
  }

  return messages;
}
