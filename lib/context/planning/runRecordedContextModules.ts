import { z } from "zod";
import { createContextExecution } from "@/lib/supabase/context_requests/createContextExecution";
import { saveContextExecutionOutcome } from "@/lib/supabase/context_requests/saveContextExecutionOutcome";
import { runPlannedContextModules } from "./runPlannedContextModules";

type Scheduler = Parameters<typeof runPlannedContextModules>[1];
type Outcome = Parameters<Scheduler["persistOutcome"]>[0];
interface Dependencies {
  authorizeExecution: (actor: string, owner: string, requestId: string) => Promise<unknown>;
  authorizeNode: Scheduler["authorize"];
  dispatch: Scheduler["dispatch"];
  createExecution?: typeof createContextExecution;
  saveOutcome?: (owner: string, executionId: string, outcome: Outcome) => Promise<unknown>;
}

/** One in-process attempt. An existing execution must be reconciled, never dispatched again. */
export async function runRecordedContextModules(
  input: {
    actor: string;
    owner: string;
    requestId: string;
    executionId: string;
    policyVersion: string;
    plan: unknown;
  },
  deps: Dependencies,
) {
  const ids = z
    .object({
      actor: z.uuid(),
      owner: z.uuid(),
      requestId: z.uuid(),
      executionId: z.uuid(),
      policyVersion: z.string().min(1).max(100),
    })
    .parse(input);
  await deps.authorizeExecution(ids.actor, ids.owner, ids.requestId);
  const execution = await (deps.createExecution ?? createContextExecution)(
    ids.owner,
    ids.requestId,
    ids.executionId,
    ids.policyVersion,
    input.plan,
  );
  if (!execution.created) throw new Error("Execution replay requires reconciliation");
  return runPlannedContextModules(input.plan, {
    authorize: deps.authorizeNode,
    dispatch: deps.dispatch,
    persistOutcome: outcome =>
      (deps.saveOutcome ?? saveContextExecutionOutcome)(ids.owner, ids.executionId, outcome),
  });
}
