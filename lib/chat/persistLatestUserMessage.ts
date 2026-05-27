import { upsertChatMessage } from "@/lib/supabase/chat_messages/upsertChatMessage";
import { selectChatMessages } from "@/lib/supabase/chat_messages/selectChatMessages";
import { updateChat } from "@/lib/supabase/chats/updateChat";

type TextPart = { type: "text"; text: string };
type UserMessage = { id: string; role: string; parts: Array<TextPart | { type: string }> };

const TITLE_MAX_LENGTH = 80;
const TRUNCATION_SUFFIX = "…";
const TITLE_BODY_BUDGET = TITLE_MAX_LENGTH - TRUNCATION_SUFFIX.length;

/**
 * Fire-and-forget persistence of the latest user message in a chat-workflow
 * request. Called before `start(runAgentWorkflow, ...)` so that:
 *
 *   - A page refresh during workflow queue time still shows the user message.
 *   - The chat's `updated_at` reflects activity even if the workflow hasn't
 *     produced its first chunk yet.
 *   - The chat title is set from the first user message (capped at 80 chars
 *     including the truncation suffix, addressing the prior off-by-3 bug).
 *
 * Title-eligibility uses "earliest message in the chat", not "only message",
 * so a fast-following second message can't race past the title-set.
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

    const inserted = await upsertChatMessage({
      id: latest.id,
      chat_id: chatId,
      role: "user",
      parts: latest as never,
    });

    // Bail on DB errors (already logged). Don't touch the chat or set a title
    // since we can't confirm the message landed.
    if (!inserted.ok) return;

    // If it was a duplicate, the original insert already drove side effects.
    if (inserted.isDuplicate || inserted.row === null) return;

    await updateChat({ id: chatId }, { updated_at: new Date().toISOString() });

    // Title-set is gated on "is this row still the earliest message in the chat?"
    // — a fast follow-up message that landed before this query wouldn't shift
    // the earliest row's id, so we'd still title from this message correctly,
    // and racing in the opposite direction (this message landed second) gives
    // us a different id at position 0 and we correctly skip.
    const earliest = await selectChatMessages({
      chatId,
      orderBy: { createdAt: "asc" },
      limit: 1,
    });

    // DB-error or no rows — bail without titling.
    if (!earliest || earliest.length === 0) return;
    if (earliest[0]?.id !== inserted.row.id) return;

    const text = latest.parts
      .filter((part): part is TextPart => part.type === "text")
      .map(part => part.text)
      .join(" ")
      .trim();
    if (text.length === 0) return;

    const title =
      text.length > TITLE_MAX_LENGTH
        ? `${text.slice(0, TITLE_BODY_BUDGET)}${TRUNCATION_SUFFIX}`
        : text;
    await updateChat({ id: chatId }, { title });
  } catch (error) {
    console.error("[persistLatestUserMessage] error:", error);
  }
}
