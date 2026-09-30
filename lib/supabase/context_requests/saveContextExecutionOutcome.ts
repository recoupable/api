import { z } from "zod";
import { callContextRpc } from "./callContextRpc";

const schema = z.looseObject({
  key: z.string().min(1),
  status: z.enum(["saved", "reused", "failed", "blocked"]),
  blockedBy: z.array(z.string().min(1)).max(100).optional(),
  blockReason: z.enum(["plan_blocked", "not_implemented", "dependency_failed"]).optional(),
  reasons: z.array(z.string().min(1).max(500)).max(100).optional(),
  failureStage: z.enum(["authorize", "dispatch"]).optional(),
  receipt: z.unknown().optional(),
});

/** Store evidence identity, never collector payloads, credentials or raw provider errors. */
export async function saveContextExecutionOutcome(
  owner: string,
  executionId: string,
  input: unknown,
) {
  z.uuid().parse(owner);
  z.uuid().parse(executionId);
  const outcome = schema.parse(input);
  const receipt =
    outcome.status === "saved" || outcome.status === "reused"
      ? z.object({ state: z.literal(outcome.status), resultId: z.uuid() }).parse(outcome.receipt)
      : undefined;
  const safeOutcome = {
    key: outcome.key,
    status: outcome.status,
    ...(outcome.blockedBy ? { blockedBy: outcome.blockedBy } : {}),
    ...(outcome.blockReason ? { blockReason: outcome.blockReason } : {}),
    ...(outcome.reasons ? { reasons: outcome.reasons } : {}),
    ...(outcome.failureStage ? { failureStage: outcome.failureStage } : {}),
    ...(receipt ? { receipt } : {}),
  };
  return callContextRpc("save_context_execution_outcome", {
    p_owner: owner,
    p_execution: executionId,
    p_node_key: outcome.key,
    p_outcome: safeOutcome,
  });
}
