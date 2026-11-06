import type { Message } from "chat";
import { z } from "zod";

const bindingsSchema = z.record(z.string(), z.string().uuid());
const slackIdentitySchema = z.object({
  team_id: z
    .string()
    .regex(/^T[A-Z0-9]+$/)
    .optional(),
  team: z
    .string()
    .regex(/^T[A-Z0-9]+$/)
    .optional(),
  user: z.string().regex(/^[UW][A-Z0-9]+$/),
});

/**
 * Resolve an explicitly configured Slack workspace/member to a Recoup account.
 * Only call for messages delivered by the signature-verifying Slack adapter.
 * No identity is accepted from prompt text, display names or email addresses.
 */
export function resolveContentAccount(message: Pick<Message, "raw" | "author">): string | null {
  if (!message.author || message.author.isBot || message.author.isMe) return null;
  const identity = slackIdentitySchema.safeParse(message.raw);
  if (!identity.success || identity.data.user !== message.author.userId) return null;
  const { team, team_id: teamId, user } = identity.data;
  if ((!team && !teamId) || (team && teamId && team !== teamId)) return null;

  try {
    const bindings = bindingsSchema.safeParse(
      JSON.parse(process.env.SLACK_CONTENT_ACCOUNT_BINDINGS ?? "{}"),
    );
    if (!bindings.success) return null;
    const key = `${team ?? teamId}:${user}`;
    return Object.hasOwn(bindings.data, key) ? bindings.data[key] : null;
  } catch {
    return null;
  }
}
