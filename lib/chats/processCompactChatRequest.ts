import selectRoom from "@/lib/supabase/rooms/selectRoom";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { compactChat, CompactChatResult } from "./compactChat";

export type CompactChatProcessResult =
  | { type: "notFound"; chatId: string }
  | { type: "success"; result: CompactChatResult };

interface ProcessCompactChatRequestParams {
  chatId: string;
  prompt?: string;
  accountId: string;
  orgId?: string;
}

/**
 * Processes a single chat compaction request.
 * Verifies the chat exists and the user has access before compacting.
 *
 * @param params - The parameters for processing the chat compaction.
 * @returns The result of the compaction attempt.
 */
export async function processCompactChatRequest({
  chatId,
  prompt,
  accountId,
  orgId,
}: ProcessCompactChatRequestParams): Promise<CompactChatProcessResult> {
  // Verify the chat exists
  const room = await selectRoom(chatId);
  if (!room) {
    return { type: "notFound", chatId };
  }

  // Verify user has access to the chat
  const roomAccountId = room.account_id;
  if (roomAccountId && roomAccountId !== accountId) {
    // Check if org key has access to this account
    const hasAccess = await canAccessAccount({
      orgId,
      targetAccountId: roomAccountId,
    });
    if (!hasAccess) {
      return { type: "notFound", chatId };
    }
  }

  // Compact the chat
  const compactResult = await compactChat(chatId, prompt);
  return { type: "success", result: compactResult };
}
