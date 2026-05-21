import { createChatMessageIfNotExists } from "@/lib/supabase/chat_messages/createChatMessageIfNotExists";
import { isFirstChatMessage } from "@/lib/supabase/chat_messages/isFirstChatMessage";
import { touchChat } from "@/lib/supabase/chats/touchChat";
import { updateChat } from "@/lib/supabase/chats/updateChat";

type TextPart = { type: "text"; text: string };
type UserMessage = { id: string; role: string; parts: Array<TextPart | { type: string }> };

const TITLE_MAX_LENGTH = 80;

/**
 * Fire-and-forget persistence of the latest user message in a chat-workflow
 * request. Called before `start(runAgentWorkflow, ...)` so that:
 *
 *   - A page refresh during workflow queue time still shows the user message.
 *   - The chat's `updated_at` reflects activity even if the workflow hasn't
 *     produced its first chunk yet.
 *   - The chat title is set from the first user message (truncated to ~80 chars).
 *
 * All failures are caught and logged — this MUST NOT block the request path.
 *
 * @param chatId - The target chat.
 * @param messages - The full message list from the request body.
 */
export async function persistLatestUserMessage(
  chatId: string,
  messages: UserMessage[],
): Promise<void> {
  try {
    const latest = messages[messages.length - 1];
    if (!latest || latest.role !== "user") return;

    const created = await createChatMessageIfNotExists({
      id: latest.id,
      chat_id: chatId,
      role: "user",
      parts: latest as never,
    });

    if (!created) return;

    await touchChat(chatId);

    const shouldSetTitle = await isFirstChatMessage(chatId, created.id);
    if (!shouldSetTitle) return;

    const text = latest.parts
      .filter((part): part is TextPart => part.type === "text")
      .map(part => part.text)
      .join(" ")
      .trim();

    if (text.length > 0) {
      const title = text.length > TITLE_MAX_LENGTH ? `${text.slice(0, TITLE_MAX_LENGTH)}...` : text;
      await updateChat(chatId, { title });
    }
  } catch (error) {
    console.error("[persistLatestUserMessage] error:", error);
  }
}
