import selectMemories from "@/lib/supabase/memories/selectMemories";
import { createCompactAgent } from "@/lib/agents/CompactAgent";

export interface CompactChatResult {
  chatId: string;
  compacted: string;
}

/**
 * Compacts a single chat by summarizing its messages using the CompactAgent.
 *
 * @param chatId - The ID of the chat to compact.
 * @param customPrompt - Optional custom prompt to guide the summarization.
 * @returns The compacted result with chatId and summary text.
 */
export async function compactChat(
  chatId: string,
  customPrompt?: string,
): Promise<CompactChatResult> {
  // Get all messages for the chat in chronological order
  const memories = await selectMemories(chatId, { ascending: true });

  if (!memories || memories.length === 0) {
    return {
      chatId,
      compacted: "",
    };
  }

  // Format messages for summarization
  const formattedMessages = memories
    .map(memory => {
      const content = memory.content as { role?: string; content?: string };
      const role = content?.role || "unknown";
      const text = content?.content || JSON.stringify(content);
      return `${role}: ${text}`;
    })
    .join("\n\n");

  // Create agent with custom instructions if provided
  const agent = createCompactAgent(customPrompt);

  // Generate summary using the agent
  const prompt = `Conversation to summarize:\n\n${formattedMessages}`;
  const result = await agent.generate({ prompt });

  return {
    chatId,
    compacted: result.text,
  };
}
