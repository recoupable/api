import { evaluateSandboxLifecycle } from "@/lib/sandbox/evaluateSandboxLifecycle";
import type {
  SandboxLifecycleEvaluationResult,
  SandboxLifecycleReason,
} from "@/lib/sandbox/sandboxLifecycleTypes";

/**
 * Workflow step that runs a single lifecycle evaluation pass. Thin
 * wrapper around `evaluateSandboxLifecycle` so the workflow
 * orchestrator gets a step boundary (with `"use step"` durability
 * semantics) on each evaluation.
 *
 * @param sessionId - The session whose sandbox to evaluate.
 * @param reason - Why the workflow was triggered (for logging only).
 * @returns The result of this single evaluation pass.
 */
export async function runLifecycleEvaluation(
  sessionId: string,
  reason: SandboxLifecycleReason,
): Promise<SandboxLifecycleEvaluationResult> {
  "use step";
  return evaluateSandboxLifecycle(sessionId, reason);
}
