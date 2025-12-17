import { NextResponse } from "next/server";
import type { ResendEmailReceivedEvent } from "@/lib/emails/validateInboundEmailEvent";
import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { getMessages } from "@/lib/messages/getMessages";
import getGeneralAgent from "@/lib/agents/generalAgent/getGeneralAgent";
import { getEmailContent } from "@/lib/emails/inbound/getEmailContent";
import { getFromWithName } from "@/lib/emails/inbound/getFromWithName";

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

    const emailText = await getEmailContent(emailId);

    const accountEmails = await selectAccountEmails({ emails: [to] });
    if (accountEmails.length === 0) throw new Error("Account not found");
    const accountId = accountEmails[0].account_id;

    const decision = await getGeneralAgent({ accountId, messages: getMessages(emailText) });
    const agent = decision.agent;
    const chatResponse = await agent.generate({
      prompt: emailText,
    });
    const payload = {
      from,
      to: toArray,
      subject,
      html: `<p>${chatResponse.text}</p>`,
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
