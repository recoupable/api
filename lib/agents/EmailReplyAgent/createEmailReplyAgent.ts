import { Output, ToolLoopAgent, stepCountIs } from "ai";
import { z } from "zod";
import { LIGHTWEIGHT_MODEL } from "@/lib/const";

const replyDecisionSchema = z.object({
  shouldReply: z.boolean().describe("Whether the Recoup AI assistant should reply to this email"),
});

const instructions = `You analyze emails to determine if a Recoup AI assistant (@mail.recoupable.com) should reply.

Rules (check in this order):
1. FIRST check the body/subject: If the sender explicitly asks NOT to reply (e.g., "don't reply", "do not reply", "stop replying", "no response needed") → return false
2. If the email explicitly asks Recoup TO reply or respond (e.g., "recoup reply", "rope in recoup to reply", "have recoup respond", "ask recoup") → return true
3. If Recoup is in TO and the email asks a question or requests help → return true
4. If Recoup is ONLY in CC: return true only if directly addressed, otherwise return false
5. When in doubt, return false`;

/**
 * Creates a ToolLoopAgent configured for email reply decisions.
 *
 * @returns A configured ToolLoopAgent instance for determining if a reply is needed.
 */
export function createEmailReplyAgent() {
  return new ToolLoopAgent({
    model: LIGHTWEIGHT_MODEL,
    instructions,
    output: Output.object({ schema: replyDecisionSchema }),
    stopWhen: stepCountIs(1),
  });
}
