import type { UIMessage } from "ai";
import { upsertChatMessage } from "@/lib/supabase/chat_messages/upsertChatMessage";
import { updateChat } from "@/lib/supabase/chats/updateChat";

/**
 * Persist the streaming assistant message, overwriting its row as it grows
 * (DO UPDATE on a stable id), and bump the chat's assistant-activity
 * timestamps. Called per step from `runAgentStep`, so a stopped or crashed
 * turn keeps the partial reply it produced and still surfaces as unread
 * (`getChatSummaries` derives `hasUnread` from
 * `last_assistant_message_at > last_read_at`); `updated_at` re-sorts the
 * chat to the top. Bumped on every successful persist — under DO UPDATE the
 * upsert returns a row each time, so an interrupted reply isn't dropped.
 *
 * Never throws: the AI SDK awaits stream callbacks un-guarded, so an
 * escaping error would tear down the client stream. Errors are logged.
 */
export async function persistAssistantMessage(chatId: string, message: UIMessage): Promise<void> {
  try {
    if (message?.role !== "assistant") return;

    const upserted = await upsertChatMessage(
      {
        id: message.id,
        chat_id: chatId,
        role: "assistant",
        parts: message as never,
      },
      { update: true },
    );

    if (!upserted.ok) return;

    const activityAt = new Date().toISOString();
    await updateChat(
      { id: chatId },
      { updated_at: activityAt, last_assistant_message_at: activityAt },
    );
  } catch (error) {
    console.error("[persistAssistantMessage] error:", error);
  }
}
