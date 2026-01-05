import generateText from "@/lib/ai/generateText";
import { LIGHTWEIGHT_MODEL } from "@/lib/const";
import type { ResendEmailData } from "@/lib/emails/validateInboundEmailEvent";

type CcEmailContext = Pick<ResendEmailData, "from" | "to" | "cc" | "subject"> & { body: string };

/**
 * Uses an LLM to determine if a reply is expected when Recoup is only CC'd on an email.
 *
 * When Recoup is CC'd (not in TO), we need to determine if the sender expects a reply
 * from Recoup or if they're just keeping Recoup informed/in the loop.
 *
 * @param context - The email context including from, to, cc, subject, and body
 * @returns true if a reply is expected, false if Recoup is just being CC'd for visibility
 */
export async function shouldReplyToCcEmail(context: CcEmailContext): Promise<boolean> {
  const { from, to, cc, subject, body } = context;

  const prompt = `You are analyzing an email where a Recoup AI assistant (@mail.recoupable.com) was CC'd but NOT directly addressed in the TO field.

Determine if the sender expects a reply from the Recoup AI assistant, or if they're just CC'ing Recoup for visibility/record-keeping.

Email details:
- From: ${from}
- To: ${to.join(", ")}
- CC: ${cc.join(", ")}
- Subject: ${subject}
- Body: ${body}

Signs that a reply IS expected:
- The email body directly addresses or mentions Recoup/the AI assistant
- The sender asks a question that Recoup should answer
- The sender requests action or information from Recoup
- The context suggests Recoup's input is needed

Signs that NO reply is expected (just CC'd for visibility):
- The email is a conversation between other parties
- Recoup is just being kept in the loop for record-keeping
- The email is informational with no action required from Recoup
- The message is addressed specifically to the TO recipients

Respond with ONLY "true" if a reply is expected, or "false" if no reply is expected.`;

  const response = await generateText({
    prompt,
    model: LIGHTWEIGHT_MODEL,
  });

  const result = response.text.trim().toLowerCase();
  return result === "true";
}
