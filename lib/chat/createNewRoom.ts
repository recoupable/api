import { insertRoom } from "@/lib/supabase/rooms/insertRoom";
import { generateChatTitle } from "@/lib/chat/generateChatTitle";
import { sendNewConversationNotification } from "@/lib/telegram/sendNewConversationNotification";
import { UIMessage } from "ai";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

interface CreateNewRoomParams {
  accountId: string;
  roomId: string;
  artistId?: string;
  lastMessage: UIMessage;
}

/**
 * Creates a new room and sends a notification for a new conversation.
 *
 * @param params - The parameters for creating a new room
 * @param params.accountId - The account ID
 * @param params.roomId - The room ID
 * @param params.artistId - Optional artist ID
 * @param params.lastMessage - The last message from the conversation
 * @returns void
 */
export async function createNewRoom({
  accountId,
  roomId,
  artistId,
  lastMessage,
}: CreateNewRoomParams): Promise<void> {
  const latestMessageText = lastMessage.parts.find(part => part.type === "text")?.text || "";
  const conversationName = await generateChatTitle(latestMessageText);

  let email = "";
  const accountEmails = await selectAccountEmails({ accountIds: accountId });
  if (accountEmails.length > 0 && accountEmails[0].email) {
    email = accountEmails[0].email;
  }

  await Promise.all([
    insertRoom({
      account_id: accountId,
      topic: conversationName,
      artist_id: artistId || undefined,
      id: roomId,
    }),
    sendNewConversationNotification({
      accountId,
      email,
      conversationId: roomId,
      topic: conversationName,
      firstMessage: latestMessageText,
    }),
  ]);
}
