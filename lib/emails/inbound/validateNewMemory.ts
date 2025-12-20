import { NextResponse } from "next/server";
import type { ResendEmailReceivedEvent } from "@/lib/emails/validateInboundEmailEvent";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { getMessages } from "@/lib/messages/getMessages";
import { getEmailContent } from "@/lib/emails/inbound/getEmailContent";
import { getEmailRoomId } from "@/lib/emails/inbound/getEmailRoomId";
import { ChatRequestBody } from "@/lib/chat/validateChatRequest";
import insertMemories from "@/lib/supabase/memories/insertMemories";
import filterMessageContentForMemories from "@/lib/messages/filterMessageContentForMemories";
import { createNewRoom } from "@/lib/chat/createNewRoom";
import { generateUUID } from "@/lib/uuid/generateUUID";

/**
 * Validates and processes a new memory from an inbound email.
 * Handles room creation, memory insertion, and duplicate detection.
 *
 * @param event - The validated Resend email received event.
 * @returns Either a ChatRequestBody and emailText for processing or a NextResponse if email was already processed.
 */
export async function validateNewMemory(
  event: ResendEmailReceivedEvent,
): Promise<{ chatRequestBody: ChatRequestBody; emailText: string } | { response: NextResponse }> {
  const original = event.data;
  const emailId = original.email_id;
  const to = original.from;

  // Get account information
  const accountEmails = await selectAccountEmails({ emails: [to] });
  if (accountEmails.length === 0) throw new Error("Account not found");
  const accountId = accountEmails[0].account_id;

  // Get email content
  const emailContent = await getEmailContent(emailId);
  const emailText = emailContent.text || emailContent.html || "";

  // Get or create room
  const roomId = await getEmailRoomId(emailContent);
  const finalRoomId = roomId || generateUUID();
  const promptMessage = getMessages(emailText)[0];
  if (!roomId) {
    await createNewRoom({
      accountId,
      roomId: finalRoomId,
      artistId: undefined,
      lastMessage: promptMessage,
    });
  }

  // Insert the prompt message with emailId as the id to prevent duplicate processing
  // If this email was already processed, the insert will fail with a unique constraint violation
  try {
    await insertMemories({
      id: emailId,
      room_id: finalRoomId,
      content: filterMessageContentForMemories(promptMessage),
    });
  } catch (error: unknown) {
    // If duplicate (unique constraint violation), return early to prevent duplicate response
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      console.log(`[validateNewMemory] Email ${emailId} already processed, skipping`);
      return {
        response: NextResponse.json({ message: "Email already processed" }, { status: 200 }),
      };
    }
    throw error;
  }

  // Initialize chat request body
  const chatRequestBody: ChatRequestBody = {
    accountId,
    messages: getMessages(emailText),
    roomId: finalRoomId,
  };

  return { chatRequestBody, emailText };
}
