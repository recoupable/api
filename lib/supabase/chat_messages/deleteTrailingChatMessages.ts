import supabase from "@/lib/supabase/serverClient";
import { buildChatMessageTrailingDeleteFilter } from "@/lib/supabase/chat_messages/buildChatMessageTrailingDeleteFilter";

export interface TrailingDeleteBoundary {
  createdAt: string;
  id: string;
}

/**
 * Deletes the boundary message and every newer message in a workflow chat.
 *
 * Uses the boundary coordinates validated upstream and issues a single scoped
 * delete via the stable `(created_at, id)` ordering shared with message reads.
 *
 * @param chatId - Workflow chat UUID whose trailing messages should be removed.
 * @param boundary - Inclusive deletion boundary coordinates from validation.
 * @returns True when deletion succeeds, false on delete failure.
 */
export async function deleteTrailingChatMessages(
  chatId: string,
  boundary: TrailingDeleteBoundary,
): Promise<boolean> {
  const { error } = await supabase
    .from("chat_messages")
    .delete()
    .eq("chat_id", chatId)
    .or(buildChatMessageTrailingDeleteFilter(boundary));

  if (error) {
    console.error("[deleteTrailingChatMessages] error:", error);
    return false;
  }

  return true;
}
