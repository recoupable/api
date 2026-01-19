import { NextResponse } from "next/server";
import type { ResendEmailReceivedEvent } from "@/lib/emails/validateInboundEmailEvent";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { getMessages } from "@/lib/messages/getMessages";
import { getEmailContent } from "@/lib/emails/inbound/getEmailContent";
import { getEmailRoomId } from "@/lib/emails/inbound/getEmailRoomId";
import { ChatRequestBody } from "@/lib/chat/validateChatRequest";
import { setupConversation } from "@/lib/chat/setupConversation";
import insertMemoryEmail from "@/lib/supabase/memory_emails/insertMemoryEmail";
import { trimRepliedContext } from "@/lib/emails/inbound/trimRepliedContext";

/**
 * Validates and processes a new memory from an inbound email.
 * Handles room creation, memory insertion, and duplicate detection.
 *
 * @param event - The validated Resend email received event.
 * @returns Either a ChatRequestBody and emailText for processing or a NextResponse if email was already processed.
 */
export async function validateNewEmailMemory(
  event: ResendEmailReceivedEvent,
): Promise<{ chatRequestBody: ChatRequestBody; emailText: string } | { response: NextResponse }> {
  const original = event.data;
  const emailId = original.email_id;
  const to = original.from;

  const accountEmails = await selectAccountEmails({ emails: [to] });
  if (accountEmails.length === 0) throw new Error("Account not found");
  const accountId = accountEmails[0].account_id;

  const emailContent = await getEmailContent(emailId);
  const emailText = trimRepliedContext(emailContent.html || "");

  const roomId = await getEmailRoomId(emailContent);
  const promptMessage = getMessages(emailText)[0];

  // Setup conversation: auto-create room if needed and persist user message
  // Uses emailId as memoryId for deduplication - duplicate inserts will fail with unique constraint
  let finalRoomId: string;
  try {
    const result = await setupConversation({
      accountId,
      roomId,
      promptMessage,
      memoryId: emailId,
    });
    finalRoomId = result.roomId;
  } catch (error: unknown) {
    // If duplicate (unique constraint violation), return early to prevent duplicate response
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      console.log(`[validateNewEmailMemory] Email ${emailId} already processed, skipping`);
      return {
        response: NextResponse.json({ message: "Email already processed" }, { status: 200 }),
      };
    }
    throw error;
  }

  // Link the inbound email with the prompt message memory (using emailId as the memory id)
  // The user message was already inserted with emailId as the id, so we use that directly
  const messageId = original.message_id;
  await insertMemoryEmail({
    email_id: emailId,
    memory: emailId,
    message_id: messageId,
    created_at: original.created_at,
  });

  const chatRequestBody: ChatRequestBody = {
    accountId,
    orgId: null,
    messages: getMessages(emailText),
    roomId: finalRoomId,
  };

  return { chatRequestBody, emailText };
}
