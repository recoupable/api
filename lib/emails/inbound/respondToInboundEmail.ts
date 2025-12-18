import { NextResponse } from "next/server";
import type { ResendEmailReceivedEvent } from "@/lib/emails/validateInboundEmailEvent";
import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { getMessages } from "@/lib/messages/getMessages";
import getGeneralAgent from "@/lib/agents/generalAgent/getGeneralAgent";
import { getEmailContent } from "@/lib/emails/inbound/getEmailContent";
import { getFromWithName } from "@/lib/emails/inbound/getFromWithName";
import { getEmailRoomId } from "@/lib/emails/inbound/getEmailRoomId";
import { getEmailRoomMessages } from "@/lib/emails/inbound/getEmailRoomMessages";
import { handleChatCompletion } from "@/lib/chat/handleChatCompletion";
import { ChatRequestBody } from "@/lib/chat/validateChatRequest";
import insertMemoryEmail from "@/lib/supabase/memory_emails/insertMemoryEmail";

/**
 * Responds to an inbound email by sending a hard-coded reply in the same thread.
 * Builds the reply payload and sends it via Resend.
 *
 * @param event - The validated Resend email received event.
 * @returns A NextResponse with the Resend API response or an error response.
 */
export async function respondToInboundEmail(
  event: ResendEmailReceivedEvent,
): Promise<NextResponse> {
  try {
    const original = event.data;
    const subject = original.subject ? `Re: ${original.subject}` : "Re: Your email";
    const messageId = original.message_id;
    const emailId = original.email_id;
    const to = original.from;
    const toArray = [to];
    const from = getFromWithName(original.to);

    const emailContent = await getEmailContent(emailId);
    const emailText = emailContent.text || emailContent.html || "";

    const roomId = await getEmailRoomId(emailContent);

    const accountEmails = await selectAccountEmails({ emails: [to] });
    if (accountEmails.length === 0) throw new Error("Account not found");
    const accountId = accountEmails[0].account_id;
    const chatRequestBody: ChatRequestBody = {
      accountId,
      messages: getMessages(emailText),
      ...(roomId && { roomId }),
    };
    const decision = await getGeneralAgent(chatRequestBody);
    const agent = decision.agent;

    const messages = await getEmailRoomMessages(roomId, emailText);

    const chatResponse = await agent.generate({
      messages,
    });
    const payload = {
      from,
      to: toArray,
      subject,
      html: chatResponse.text,
      headers: {
        "In-Reply-To": messageId,
      },
    };

    const result = await sendEmailWithResend(payload);

    const memories = await handleChatCompletion(
      chatRequestBody,
      getMessages(chatResponse.text, "assistant"),
    );

    // Link the inbound email with the prompt message memory only (not the assistant response)
    const promptMessageMemory = memories[0];
    if (promptMessageMemory) {
      await insertMemoryEmail({
        email_id: emailId,
        memory: promptMessageMemory.id,
        message_id: messageId,
        created_at: original.created_at,
      });
    }

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[respondToInboundEmail] Failed to respond to inbound email", error);
    return NextResponse.json({ error: "Internal error handling inbound email" }, { status: 500 });
  }
}
