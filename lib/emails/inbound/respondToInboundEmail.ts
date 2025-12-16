import { NextResponse } from "next/server";
import type { ResendEmailReceivedEvent } from "@/lib/emails/validateInboundEmailEvent";
import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

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
    const toArray = [original.from];

    // Lookup account ID in Supabase using the sender's email address
    let accountId: string | null = null;
    try {
      const accountEmails = await selectAccountEmails({ emails: [original.from] });
      if (accountEmails.length > 0) {
        accountId = accountEmails[0].account_id ?? null;
      }
    } catch (lookupError) {
      console.error("[respondToInboundEmail] Error looking up account_emails:", lookupError);
    }

    const accountIdText = accountId ?? "Unknown";

    const payload = {
      from: "hi@recoupable.com",
      to: toArray,
      subject,
      html: `<p>Thanks for your email!</p><p>account_id: ${accountIdText}</p>`,
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
    console.error("[respondToInboundEmail] Failed to respond to inbound email", error);
    return NextResponse.json({ error: "Internal error handling inbound email" }, { status: 500 });
  }
}
