import { NextResponse } from "next/server";
import type { ResendEmailData } from "@/lib/emails/validateInboundEmailEvent";
import { shouldReplyToCcEmail } from "@/lib/emails/inbound/shouldReplyToCcEmail";
import { containsRecoupEmail } from "@/lib/emails/containsRecoupEmail";

/**
 * Validates whether a reply should be sent.
 *
 * Logic:
 * - If recoup email is only in TO (not CC): Always reply (skip LLM call)
 * - If recoup email is in CC (regardless of TO): Use LLM to determine if reply is expected
 * - If recoup email is in both TO and CC: Treat as CC (use LLM)
 *
 * @param original - The original email data from the Resend webhook
 * @param emailText - The parsed email body text
 * @returns Either a NextResponse to early return (no reply needed) or null to continue
 */
export async function validateCcReplyExpected(
  original: ResendEmailData,
  emailText: string,
): Promise<{ response: NextResponse } | null> {
  const isInTo = containsRecoupEmail(original.to);
  const isInCc = containsRecoupEmail(original.cc);

  // If recoup email is only in TO (not CC), always reply - skip LLM call
  if (isInTo && !isInCc) {
    return null;
  }

  // If recoup email is in CC (or both TO and CC), use LLM to determine if reply is expected
  const shouldReply = await shouldReplyToCcEmail({
    from: original.from,
    to: original.to,
    cc: original.cc,
    subject: original.subject,
    body: emailText,
  });

  if (!shouldReply) {
    return {
      response: NextResponse.json({ message: "No reply expected" }, { status: 200 }),
    };
  }

  return null;
}
