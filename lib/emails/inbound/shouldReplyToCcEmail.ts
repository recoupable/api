import generateText from "@/lib/ai/generateText";
import { LIGHTWEIGHT_MODEL } from "@/lib/const";
import type { ResendEmailData } from "@/lib/emails/validateInboundEmailEvent";

type EmailContext = Pick<ResendEmailData, "from" | "to" | "cc" | "subject"> & { body: string };

/**
 * Uses an LLM to determine if a reply is expected from the Recoup AI assistant.
 *
 * @param context - The email context including from, to, cc, subject, and body
 * @returns true if a reply is expected, false otherwise
 */
export async function shouldReplyToCcEmail(context: EmailContext): Promise<boolean> {
  const { from, to, cc, subject, body } = context;

  const prompt = `You are analyzing an email to determine if a Recoup AI assistant (@mail.recoupable.com) should reply.

Email details:
- From: ${from}
- To: ${to.join(", ")}
- CC: ${cc.join(", ")}
- Subject: ${subject}
- Body: ${body}

Rules:
1. If a Recoup address (@mail.recoupable.com) is in the TO field → ALWAYS reply (return "true")
2. If a Recoup address is ONLY in CC (not in TO):
   - Return "true" if the email directly addresses Recoup or asks for its input
   - Return "false" if Recoup is just being kept in the loop for visibility

Respond with ONLY "true" or "false".`;

  const response = await generateText({
    prompt,
    model: LIGHTWEIGHT_MODEL,
  });

  const result = response.text.trim().toLowerCase();
  return result === "true";
}
