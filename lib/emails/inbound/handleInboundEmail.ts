import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { ResendEmailReceivedEvent } from "@/lib/emails/validateInboundEmailEvent";
import { validateInboundEmailEvent } from "@/lib/emails/validateInboundEmailEvent";
import { sendEmailWithResend } from "@/lib/emails/sendEmail";

/**
 * Handles inbound email webhook events from Resend.
 * For "email.received" events, sends a hard-coded reply email in the same thread
 * using the Resend API and returns the Resend API response payload.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse object
 */
export async function handleInboundEmail(request: NextRequest): Promise<NextResponse> {
  const body = await request.json();
  const validatedOrError = validateInboundEmailEvent(body);

  if (validatedOrError instanceof NextResponse) {
    return validatedOrError;
  }

  const event: ResendEmailReceivedEvent = validatedOrError;

  console.log("Received email event:", event);

  if (event?.type === "email.received") {
    try {
      const original = event.data;
      const subject = original.subject ? `Re: ${original.subject}` : "Re: Your email";
      const messageId = original.message_id;
      const fromAddress = original.to[0];
      const toArray = [original.from];

      const payload = {
        from: fromAddress,
        to: toArray,
        subject,
        html: "<p>Thanks for your email!</p>",
        headers: {
          "In-Reply-To": messageId,
        },
      };

      const result = await sendEmailWithResend(payload);

      if (result instanceof NextResponse) {
        return result;
      }

      return NextResponse.json(result.data);
    } catch (error) {
      console.error("[handleInboundEmail] Failed to handle email.received event", error);
      return NextResponse.json({ error: "Internal error handling inbound email" }, { status: 500 });
    }
  }

  // For non-email.received events, just acknowledge with an empty payload
  return NextResponse.json({});
}
