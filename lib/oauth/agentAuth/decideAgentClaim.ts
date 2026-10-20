import { timingSafeEqual } from "node:crypto";
import { errors } from "oidc-provider";
import { z } from "zod";
import type { AgentClaimIdentity, AgentRegistration } from "./AgentRegistration";
import { AgentRegistrationError } from "./AgentRegistrationError";
import { agentRegistrationPolicy as policy } from "./agentRegistrationPolicy";
import { completeAgentApproval } from "./completeAgentApproval";
import type { AgentRegistrationContext } from "./createAgentRegistrationContext";

const decisionSchema = z.discriminatedUnion("decision", [
  z.strictObject({
    decision: z.literal("approve"),
    csrf: z.string(),
    user_code: z.string().regex(/^\d{6}$/),
  }),
  z.strictObject({ decision: z.literal("deny"), csrf: z.string() }),
]);

/** Bind a typed code and one-use consent ticket with an atomic registration transition. */
export async function decideAgentClaim(
  context: AgentRegistrationContext,
  attempt: string,
  input: unknown,
  identity: AgentClaimIdentity,
) {
  const { readAttempt, store, tickets, binding, now } = context;
  const decision = decisionSchema.parse(input);
  // CAS retries handle simultaneous polls without losing a decision or code-attempt count.
  for (let retry = 0; retry < 12; retry++) {
    const saved = await readAttempt(attempt, identity);
    const { record } = saved;
    if (decision.decision === "approve") {
      const correct = timingSafeEqual(
        Buffer.from(record.codeHash),
        Buffer.from(store.hash(`${record.id}:${decision.user_code}`)),
      );
      if (!correct) {
        const failedAttempts = record.failedAttempts + 1;
        if (
          !(await store.replace(saved, {
            ...record,
            failedAttempts,
            status: failedAttempts >= policy.maxCodeAttempts ? "denied" : "pending",
          }))
        )
          continue;
        throw new AgentRegistrationError("invalid_user_code");
      }
    }
    try {
      await tickets.consume(decision.csrf, binding(record, identity));
    } catch (error) {
      if (
        error instanceof errors.InvalidGrant ||
        (error instanceof Error && error.message === "Invalid OAuth approval")
      )
        throw new AgentRegistrationError("invalid_request");
      throw error;
    }
    // The registration lock, not the browser ticket, decides which account can bind it.
    const approved = decision.decision === "approve";
    const next: AgentRegistration = {
      ...record,
      status: approved ? "approving" : "denied",
      ...(approved
        ? {
            accountId: identity.accountId,
            subject: identity.subject,
            accessExpiresAt: now() + policy.connectionSeconds,
          }
        : {}),
    };
    // A concurrent poll may have advanced the ciphertext after ticket consumption.
    let current = saved;
    let locked = false;
    for (let lockRetry = 0; lockRetry < 12; lockRetry++) {
      if (
        await store.replace(current, {
          ...next,
          lastPollAt: current.record.lastPollAt,
          pollInterval: current.record.pollInterval,
        })
      ) {
        locked = true;
        break;
      }
      current = await readAttempt(attempt, identity);
    }
    if (!locked) throw new AgentRegistrationError("temporarily_unavailable", 503);
    if (!approved) return { status: "denied" };
    await completeAgentApproval(context, next);
    return { status: "approved" };
  }
  throw new AgentRegistrationError("temporarily_unavailable", 503);
}
