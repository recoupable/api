import type { ModelMessage } from "ai";
import selectMemories from "@/lib/supabase/memories/selectMemories";

interface UIPart {
  type: string;
  text?: string;
  toolName?: string;
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
}

interface MemoryContent {
  role: string;
  parts: UIPart[];
}

/**
 * Extracts text content from UI parts.
 *
 * @param parts - UI parts from stored memory
 * @returns Combined text string from all text parts
 */
function extractText(parts: UIPart[]): string {
  return parts
    .filter(p => p.type === "text" && p.text)
    .map(p => p.text!)
    .join("\n");
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
      text = extractText(content.parts);
      if (text) {
        messages.push({ role, content: text });
      }
    }
  }

  return messages;
}
