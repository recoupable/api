import { getPackLaunchFence } from "./getPackLaunchFence";
import type { PackLaunchFence } from "./packFenceTypes";
import { PackFenceError } from "./PackFenceError";
export function assertPackExecutionIdentity(
  job: { [key: string]: unknown; protocol?: number; workflow_run_id?: string | null },
  original: PackLaunchFence | undefined,
  workflowId?: string,
) {
  if (job.protocol !== 2) throw new PackFenceError("Execution fence requires protocol 2");
  if (!original) throw new PackFenceError("Missing original execution identity");
  const actual = getPackLaunchFence(job);
  if (
    actual.execution_id !== original.execution_id ||
    actual.execution_version !== original.execution_version ||
    actual.expected_revision !== original.expected_revision ||
    (workflowId !== undefined && job.workflow_run_id !== workflowId)
  )
    throw new PackFenceError("Pack execution changed before effects");
}
