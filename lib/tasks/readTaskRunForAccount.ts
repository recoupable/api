import { retrieveTaskRun } from "@/lib/trigger/retrieveTaskRun";
import { canReadTaskRun } from "./canReadTaskRun";

/** Returns the provider run only when its ownership is verifiable for the resolved account. */
export async function readTaskRunForAccount({
  runId,
  accountId,
}: {
  runId: string;
  accountId: string;
}) {
  const run = await retrieveTaskRun(runId);
  if (!run || !(await canReadTaskRun(run, accountId))) return null;
  return run;
}
