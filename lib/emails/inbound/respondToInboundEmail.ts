import { NextResponse } from "next/server";
import type { ResendEmailReceivedEvent } from "@/lib/emails/validateInboundEmailEvent";
import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { getMessages } from "@/lib/messages/getMessages";
import getGeneralAgent from "@/lib/agents/generalAgent/getGeneralAgent";
import { getFromWithName } from "@/lib/emails/inbound/getFromWithName";
import { getEmailRoomMessages } from "@/lib/emails/inbound/getEmailRoomMessages";
import insertMemories from "@/lib/supabase/memories/insertMemories";
import filterMessageContentForMemories from "@/lib/messages/filterMessageContentForMemories";
import { validateNewEmailMemory } from "@/lib/emails/inbound/validateNewEmailMemory";

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
    const to = original.from;
    const toArray = [to];
    const from = getFromWithName(original.to);

    // Validate new memory and get chat request body (or early return if duplicate)
    const validationResult = await validateNewEmailMemory(event);
    if ("response" in validationResult) {
      return validationResult.response;
    }

    const { chatRequestBody } = validationResult;
    const { roomId } = chatRequestBody;

    const decision = await getGeneralAgent(chatRequestBody);
    const agent = decision.agent;

    const messages = await getEmailRoomMessages(roomId);

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

    // Save the assistant response message
    const assistantMessage = getMessages(chatResponse.text, "assistant")[0];
    await insertMemories({
      id: assistantMessage.id,
      room_id: roomId,
      content: filterMessageContentForMemories(assistantMessage),
    });

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[respondToInboundEmail] Failed to respond to inbound email", error);
    return NextResponse.json({ error: "Internal error handling inbound email" }, { status: 500 });
  }
}
