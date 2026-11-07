import { fetchTriggerRuns } from "@/lib/trigger/fetchTriggerRuns";
import { retrieveTaskRun } from "@/lib/trigger/retrieveTaskRun";
import type { ScheduledReportRun } from "./types";

/** The Trigger.dev task every customer schedule runs (tasks repo). */
const SCHEDULED_TASK_ID = "customer-prompt-task";
/** One page of the runs API; an hour of schedules fits well inside it. */
const MAX_RUNS = 100;

/**
 * Scheduled customer-task runs created inside a window, each resolved to its
 * `scheduled_actions` id. The list endpoint omits schedule details, so each
 * run is read once more; a run that cannot be read is skipped and logged.
 *
 * @param window - ISO bounds on the runs' `createdAt`.
 * @param window.from - Inclusive lower bound.
 * @param window.to - Upper bound.
 * @returns The runs that belong to a task.
 */
export async function listScheduledReportRuns({
  from,
  to,
}: {
  from: string;
  to: string;
}): Promise<ScheduledReportRun[]> {
  const listed = await fetchTriggerRuns(
    {
      "filter[taskIdentifier]": SCHEDULED_TASK_ID,
      "filter[createdAt][from]": from,
      "filter[createdAt][to]": to,
    },
    MAX_RUNS,
  );
  if (listed.length === MAX_RUNS) {
    console.warn(`[missed-report-check] ${MAX_RUNS}+ runs in ${from}..${to}; later ones unchecked`);
  }

  const resolved = await Promise.all(
    listed.map(async run => {
      try {
        const detail = await retrieveTaskRun(run.id);
        const taskId = detail?.schedule?.externalId;
        if (!taskId) return null;
        return { runId: run.id, taskId, createdAt: run.createdAt, status: run.status };
      } catch (error) {
        console.error(`[missed-report-check] could not read run ${run.id}:`, error);
        return null;
      }
    }),
  );
  return resolved.filter((run): run is ScheduledReportRun => run !== null);
}
