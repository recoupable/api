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
}

/**
 * Process Compact Chat Request.
 *
 * @param root0 - Parameter.
 * @param root0.chatId - Parameter.
 * @param root0.prompt - Parameter.
 * @param root0.accountId - Parameter.
 * @returns - Result.
 */
export async function processCompactChatRequest({
  chatId,
  prompt,
  accountId,
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
      currentAccountId: accountId,
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
