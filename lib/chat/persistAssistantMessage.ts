import { upsertChatMessage } from "@/lib/supabase/chat_messages/upsertChatMessage";
import { updateChat } from "@/lib/supabase/chats/updateChat";

/**
 * Minimal duck-type shape we read off the assistant message. Both AI
 * SDK's `UIMessage` and the in-test fixtures structurally satisfy it.
 * Kept intentionally loose because the row we write to
 * `chat_messages.parts` is `jsonb` — Supabase persists whatever the
 * message looks like.
 */
type AssistantMessage = {
  id: string;
  role: string;
  parts: ReadonlyArray<unknown>;
};

/**
 * Fire-and-forget persistence of the final assistant message at the
 * end of a chat-workflow run. Mirrors open-agents'
 * `persistAssistantMessage` step in
 * `apps/web/app/workflows/chat-post-finish.ts` and closes the
 * silent-data-loss gap the recoup-api cutover introduced — without
 * this call the assistant response is streamed to the client but
 * never written to `chat_messages`, so a page refresh after the
 * stream completes wipes the message.
 *
 * Uses `upsertChatMessage(... { onConflict: "id", ignoreDuplicates })`
 * so a workflow that's restarted (replay, recovery) doesn't
 * double-insert. On a fresh insert we also bump
 * `last_assistant_message_at` (drives the sidebar `hasUnread` badge
 * in `getChatSummaries` — `lastAssistantMessageAt > lastReadAt`) and
 * touch `updated_at` so the sidebar sort surfaces the chat. Matches
 * open-agents' `updateChatAssistantActivity` which sets both columns
 * to the same timestamp.
 *
 * Title generation lives in `persistLatestUserMessage` (the first
 * user message is canonical for chat titles) — this function
 * deliberately does NOT update the chat title.
 *
 * Errors are caught and logged. Contract is "schedule it and forget"
 * — never block the workflow or surface failures to the UI.
 *
 * @param chatId - Target chat row.
 * @param message - The assembled assistant message (typically from
 *   `toUIMessageStream`'s `onFinish.responseMessage`).
 */
export async function persistAssistantMessage(
  chatId: string,
  message: AssistantMessage,
): Promise<void> {
  "use step";
  try {
    if (!message || message.role !== "assistant") return;

    const inserted = await upsertChatMessage({
      id: message.id,
      chat_id: chatId,
      role: "assistant",
      parts: message as never,
    });

    if (!inserted.ok) return;
    if (inserted.isDuplicate || inserted.row === null) return;

    const activityAt = new Date().toISOString();
    await updateChat(
      { id: chatId },
      { updated_at: activityAt, last_assistant_message_at: activityAt },
    );
  } catch (error) {
    console.error("[persistAssistantMessage] error:", error);
  }
}
