import { createEmailReplyAgent } from "@/lib/agents/EmailReplyAgent";
import type { ResendEmailData } from "@/lib/emails/validateInboundEmailEvent";

type EmailContext = Pick<ResendEmailData, "from" | "to" | "cc" | "subject"> & { body: string };

/**
 * Uses an agent to determine if a reply is expected from the Recoup AI assistant.
 *
 * @param context - The email context including from, to, cc, subject, and body
 * @returns true if a reply is expected, false otherwise
 */
export async function shouldReplyToCcEmail(context: EmailContext): Promise<boolean> {
  const { from, to, cc, subject, body } = context;

  const agent = createEmailReplyAgent();

  const prompt = `Analyze this email:
- From: ${from}
- To: ${to.join(", ")}
- CC: ${cc.join(", ")}
- Subject: ${subject}
- Body: ${body}`;

  const { output } = await agent.generate({ prompt });

  return output.shouldReply;
}
