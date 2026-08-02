import type { UIMessage } from "ai";
import { persistAssistantMessage } from "@/lib/chat/persistAssistantMessage";

/**
 * Persist the in-progress assistant message from the workflow body.
 *
 * Called after every agent iteration so a long turn's transcript stays live
 * in `chat_messages` rather than landing only when the turn ends. Mirrors
 * upstream open-agents, which persists `pendingAssistantResponse` from the
 * workflow body rather than from inside the agent step.
 *
 * Keeping this out of `runAgentStep` is what lets the step write parts
 * straight to the writable instead of wrapping them in a
 * `createUIMessageStream` purely to get a persist callback — a wrapper that
 * silently dropped every tool call from the transcript (chat#1918).
 *
 * `persistAssistantMessage` swallows its own errors, so this never throws.
 */
export async function persistAssistantMessageStep(
  chatId: string,
  message: UIMessage,
): Promise<void> {
  "use step";

  await persistAssistantMessage(chatId, message);
}
