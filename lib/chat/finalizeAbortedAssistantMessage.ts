import type { UIMessage } from "ai";
import { closeOpenToolCalls } from "@/lib/chat/closeOpenToolCalls";
import { persistAssistantMessage } from "@/lib/chat/persistAssistantMessage";

/**
 * On user-stop, close any tool-call parts the step boundary persisted without a
 * terminal result and re-persist. Without this a reload renders those parts as
 * spinning forever — the AI SDK only transitions a tool part when it sees a
 * terminal `output-*` chunk. A no-op (returns the original) when nothing is open.
 *
 * @param chatId - Chat whose assistant message is being finalized.
 * @param responseMessage - The assistant message persisted at the step boundary.
 * @returns The closed-and-persisted message, or the original when unchanged.
 */
export async function finalizeAbortedAssistantMessage(
  chatId: string,
  responseMessage: UIMessage,
): Promise<UIMessage> {
  const closed = closeOpenToolCalls(responseMessage);
  if (closed !== responseMessage) {
    await persistAssistantMessage(chatId, closed);
  }
  return closed;
}
