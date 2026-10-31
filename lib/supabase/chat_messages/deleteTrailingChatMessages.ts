import { z } from "zod";
import supabase from "@/lib/supabase/serverClient";
import { buildChatMessageTrailingDeleteFilter } from "./buildChatMessageTrailingDeleteFilter";
import type { ChatMessageTrailingBoundary } from "./ChatMessageTrailingBoundary";

/**
 * Delete an inclusive suffix from one Workflow chat. True means statement success,
 * including zero affected rows; it does not fence concurrent or outstanding writers.
 */
export async function deleteTrailingChatMessages(
  chatId: string,
  boundary: ChatMessageTrailingBoundary,
): Promise<boolean> {
  const scopedChatId = z.string().uuid().parse(chatId);
  const filter = buildChatMessageTrailingDeleteFilter(boundary);
  const { error } = await supabase
    .from("chat_messages")
    .delete()
    .eq("chat_id", scopedChatId)
    .or(filter);
  if (error) {
    console.error("[deleteTrailingChatMessages] error:", error);
    return false;
  }
  return true;
}
