import supabase from "@/lib/supabase/serverClient";
import { selectChatMessages } from "@/lib/supabase/chat_messages/selectChatMessages";

/**
 * Deletes the boundary message and every newer message in a workflow chat.
 *
 * @param chatId - Workflow chat UUID whose trailing messages should be removed.
 * @param fromMessageId - Message UUID marking the inclusive deletion boundary.
 * @returns True when deletion succeeds, false on lookup or delete failure.
 */
export async function deleteTrailingChatMessages(
  chatId: string,
  fromMessageId: string,
): Promise<boolean> {
  const messages =
    (await selectChatMessages({
      chatId,
      orderBy: { createdAt: "asc" },
    })) ?? [];

  const boundaryIndex = messages.findIndex(message => message.id === fromMessageId);
  if (boundaryIndex === -1) {
    return false;
  }

  const idsToDelete = messages.slice(boundaryIndex).map(message => message.id);
  if (idsToDelete.length === 0) {
    return true;
  }

  const { error } = await supabase.from("chat_messages").delete().in("id", idsToDelete);
  if (error) {
    console.error("[deleteTrailingChatMessages] error:", error);
    return false;
  }

  return true;
}
