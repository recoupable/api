import { getPackLaunchFence } from "./getPackLaunchFence";
import { PackFenceError } from "./PackFenceError";
export function getPackExecutionFence(job: {
  protocol?: number;
  revision?: number;
  execution_id?: string;
  execution_version?: number;
  workflow_run_id?: string | null;
}) {
  if (job.protocol !== 2) return {};
  if (!job.workflow_run_id) throw new PackFenceError("Missing original Pack workflow identity");
  return { ...getPackLaunchFence(job), workflow_run_id: job.workflow_run_id };
}
