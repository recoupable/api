import supabase from "@/lib/supabase/serverClient";
import { selectChatMessages } from "@/lib/supabase/chat_messages/selectChatMessages";
import { buildChatMessageTrailingDeleteFilter } from "@/lib/supabase/chat_messages/buildChatMessageTrailingDeleteFilter";

/**
 * Deletes the boundary message and every newer message in a workflow chat.
 *
 * Loads only the boundary row, then issues a single scoped delete using the
 * stable `(created_at, id)` ordering shared with message reads.
 *
 * @param chatId - Workflow chat UUID whose trailing messages should be removed.
 * @param fromMessageId - Message UUID marking the inclusive deletion boundary.
 * @returns True when deletion succeeds, false on lookup or delete failure.
 */
export async function deleteTrailingChatMessages(
  chatId: string,
  fromMessageId: string,
): Promise<boolean> {
  const boundaryRows = await selectChatMessages({
    chatId,
    id: fromMessageId,
    limit: 1,
  });

  if (boundaryRows === null) {
    return false;
  }

  const boundary = boundaryRows[0];
  if (!boundary) {
    return false;
  }

  const { error } = await supabase
    .from("chat_messages")
    .delete()
    .eq("chat_id", chatId)
    .or(
      buildChatMessageTrailingDeleteFilter({
        createdAt: boundary.created_at,
        id: boundary.id,
      }),
    );

  if (error) {
    console.error("[deleteTrailingChatMessages] error:", error);
    return false;
  }

  return true;
}
