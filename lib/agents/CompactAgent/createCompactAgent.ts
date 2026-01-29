import { ToolLoopAgent, stepCountIs } from "ai";
import { LIGHTWEIGHT_MODEL } from "@/lib/const";

const DEFAULT_INSTRUCTIONS = `You are a conversation summarizer. Create a concise summary of the conversation that:
- Preserves key information, decisions, and action items
- Maintains the essential context of the discussion
- Is significantly shorter than the original conversation
- Uses clear, professional language

Respond with only the summary text, no additional commentary.`;

/**
 * Creates a ToolLoopAgent configured for chat compaction/summarization.
 *
 * @param customInstructions - Optional custom instructions to guide summarization.
 * @returns A configured ToolLoopAgent instance for chat compaction.
 */
export function createCompactAgent(customInstructions?: string) {
  return new ToolLoopAgent({
    model: LIGHTWEIGHT_MODEL,
    instructions: customInstructions || DEFAULT_INSTRUCTIONS,
    stopWhen: stepCountIs(1),
  });
}
