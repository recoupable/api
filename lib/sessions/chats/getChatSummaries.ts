import { selectChats } from "@/lib/supabase/chats/selectChats";
import { selectChatReads } from "@/lib/supabase/chat_reads/selectChatReads";

export interface ChatSummary {
  id: string;
  sessionId: string;
  title: string;
  modelId: string | null;
  activeStreamId: string | null;
  lastAssistantMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasUnread: boolean;
  isStreaming: boolean;
}

/**
 * Returns chats in the given session as camelCase `ChatSummary` rows.
 * `hasUnread` is derived from the caller's `chat_reads` row (if any);
 * `isStreaming` is derived from `active_stream_id`.
 *
 * @param params - The session id to list and the account id to scope reads to.
 * @returns Chat summaries sorted by `createdAt` ascending, or `null` on DB failure.
 */
export async function getChatSummaries({
  sessionId,
  accountId,
}: {
  sessionId: string;
  accountId: string;
}): Promise<ChatSummary[] | null> {
  const chats = await selectChats({ sessionId });
  if (chats === null) {
    return null;
  }
  if (chats.length === 0) {
    return [];
  }

  const reads = await selectChatReads({
    accountId,
    chatIds: chats.map(row => row.id),
  });

  const lastReadByChatId = new Map<string, string>();
  for (const read of reads) {
    lastReadByChatId.set(read.chat_id, read.last_read_at);
  }

  return [...chats]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(row => {
      const lastReadAt = lastReadByChatId.get(row.id) ?? null;
      const lastAssistantMessageAt = row.last_assistant_message_at;
      const hasUnread =
        lastAssistantMessageAt !== null &&
        (lastReadAt === null ||
          new Date(lastAssistantMessageAt).getTime() > new Date(lastReadAt).getTime());

      return {
        id: row.id,
        sessionId: row.session_id,
        title: row.title,
        modelId: row.model_id,
        activeStreamId: row.active_stream_id,
        lastAssistantMessageAt,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        hasUnread,
        isStreaming: row.active_stream_id !== null,
      };
    });
}
