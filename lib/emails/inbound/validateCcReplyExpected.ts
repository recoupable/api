import { NextResponse } from "next/server";
import type { ResendEmailData } from "@/lib/emails/validateInboundEmailEvent";
import { shouldReplyToCcEmail } from "@/lib/emails/inbound/shouldReplyToCcEmail";

/**
 * Validates whether a reply should be sent by delegating to shouldReplyToCcEmail.
 *
 * @param original - The original email data from the Resend webhook
 * @param emailText - The parsed email body text
 * @returns Either a NextResponse to early return (no reply needed) or null to continue
 */
export async function validateCcReplyExpected(
  original: ResendEmailData,
  emailText: string,
): Promise<{ response: NextResponse } | null> {
  const shouldReply = await shouldReplyToCcEmail({
    from: original.from,
    to: original.to,
    cc: original.cc,
    subject: original.subject,
    body: emailText,
  });

  if (!shouldReply) {
    console.log("[validateCcReplyExpected] No reply expected, skipping");
    return {
      response: NextResponse.json({ message: "No reply expected" }, { status: 200 }),
    };
  }

  return null;
}
