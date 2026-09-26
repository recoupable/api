import { v5 as uuidv5 } from "uuid";
import { z } from "zod";
import { createContextExecution } from "@/lib/supabase/context_requests/createContextExecution";
import { saveContextExecutionOutcome } from "@/lib/supabase/context_requests/saveContextExecutionOutcome";
import { planStoredContextModules } from "./planStoredContextModules";

const policyVersion = "metadata-review-v1";
const executionNamespace = "f90fa471-2d49-4b57-972d-5f0ca3b05d34";

/** Durable review-only record. It never claims a node or invokes a collector. */
export async function recordBlockedContextPlan(actor: string, owner: string, requestId: string) {
  z.uuid().parse(actor);
  z.uuid().parse(owner);
  z.uuid().parse(requestId);
  const review = await planStoredContextModules(actor, owner, requestId);
  if (
    review.collectionPermitted ||
    review.plan.some(node => !["blocked", "not_implemented"].includes(node.state))
  )
    throw new Error("Review step can only record blocked plans");
  const executionId = uuidv5(`${requestId}:${policyVersion}`, executionNamespace);
  await createContextExecution(owner, requestId, executionId, policyVersion, review.plan);
  for (const node of review.plan) {
    await saveContextExecutionOutcome(owner, executionId, {
      key: node.key,
      status: "blocked",
      blockReason: node.state === "not_implemented" ? "not_implemented" : "plan_blocked",
      blockedBy: [],
      reasons: node.reasons,
    });
  }
  return { executionId, policyVersion, nodeCount: review.plan.length };
}
