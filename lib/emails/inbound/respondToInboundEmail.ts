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
    const emailId = original.email_id;
    const subject = original.subject ? `Re: ${original.subject}` : "Re: Your email";
    const messageId = original.message_id;
    const to = original.from;
    const toArray = [to];
    const from = getFromWithName(original.to, original.cc);
    const cc = original.cc?.length ? original.cc : undefined;

    console.log(`[respondToInboundEmail] Processing email ${emailId} from ${to}`);

    // Validate new memory and get chat request body (or early return if duplicate)
    const validationResult = await validateNewEmailMemory(event);
    if ("response" in validationResult) {
      console.log(`[respondToInboundEmail] Email ${emailId} - early return from validateNewEmailMemory`);
      return validationResult.response;
    }

    const { chatRequestBody, emailText } = validationResult;
    console.log(`[respondToInboundEmail] Email ${emailId} - memory validated, roomId=${chatRequestBody.roomId}, emailText length=${emailText.length}`);

    // Check if Recoup is only CC'd - use LLM to determine if reply is expected
    const ccValidation = await validateCcReplyExpected(original, emailText);
    if (ccValidation) {
      console.log(`[respondToInboundEmail] Email ${emailId} - CC validation returned early (not a direct reply)`);
      return ccValidation.response;
    }

    const { roomId } = chatRequestBody;

    console.log(`[respondToInboundEmail] Email ${emailId} - generating response...`);
    const { text, html } = await generateEmailResponse(chatRequestBody);
    console.log(`[respondToInboundEmail] Email ${emailId} - response generated, text length=${text.length}`);

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

    console.log(`[respondToInboundEmail] Email ${emailId} - sending reply to ${to} from ${from}`);
    const result = await sendEmailWithResend(payload);

    // Save the assistant response message
    await saveChatCompletion({ text, roomId });

    if (result instanceof NextResponse) {
      console.log(`[respondToInboundEmail] Email ${emailId} - sendEmailWithResend returned error response`);
      return result;
    }

    console.log(`[respondToInboundEmail] Email ${emailId} - reply sent successfully`);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[respondToInboundEmail] Failed to respond to inbound email", error);
    return NextResponse.json({ error: "Internal error handling inbound email" }, { status: 500 });
  }
}
