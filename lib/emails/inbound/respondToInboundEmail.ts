import { NextResponse } from "next/server";
import type { ResendEmailReceivedEvent } from "@/lib/emails/validateInboundEmailEvent";
import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { getFromWithName } from "@/lib/emails/inbound/getFromWithName";
import { validateNewEmailMemory } from "@/lib/emails/inbound/validateNewEmailMemory";
import { generateEmailResponse } from "@/lib/emails/inbound/generateEmailResponse";
import { validateCcReplyExpected } from "@/lib/emails/inbound/validateCcReplyExpected";
import { saveChatCompletion } from "@/lib/chat/saveChatCompletion";

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
    const from = getFromWithName(original.to, original.cc);
    const cc = original.cc?.length ? original.cc : undefined;

    // Validate new memory and get chat request body (or early return if duplicate)
    const validationResult = await validateNewEmailMemory(event);
    if ("response" in validationResult) {
      return validationResult.response;
    }

    const { chatRequestBody, emailText } = validationResult;

    // Check if Recoup is only CC'd - use LLM to determine if reply is expected
    const ccValidation = await validateCcReplyExpected(original, emailText);
    if (ccValidation) {
      return ccValidation.response;
    }

    const { roomId } = chatRequestBody;

    const { text, html } = await generateEmailResponse(chatRequestBody);

    const payload = {
      from,
      to: toArray,
      ...(cc && { cc }),
      subject,
      html,
      headers: {
        "In-Reply-To": messageId,
      },
    };

    const result = await sendEmailWithResend(payload);

    // Save the assistant response message
    await saveChatCompletion({ text, roomId });

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[respondToInboundEmail] Failed to respond to inbound email", error);
    return NextResponse.json({ error: "Internal error handling inbound email" }, { status: 500 });
  }
}
