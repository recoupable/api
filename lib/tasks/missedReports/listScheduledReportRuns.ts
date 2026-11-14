import { fetchTriggerRuns } from "@/lib/trigger/fetchTriggerRuns";
import { retrieveTaskRun } from "@/lib/trigger/retrieveTaskRun";
import type { ScheduledReportRun } from "./types";

/** The Trigger.dev task every customer schedule runs (tasks repo). */
const SCHEDULED_TASK_ID = "customer-prompt-task";
/** One page of the runs API; an hour of schedules fits well inside it. */
const MAX_RUNS = 100;
/** A hung Trigger.dev read must not stall the check (same budget as retrieveScheduleInfo). */
const READ_TIMEOUT_MS = 5000;

export interface ScheduledReportRunList {
  runs: ScheduledReportRun[];
  /** Runs that could not be read in time or at all. */
  unreadable: number;
  /** True when the window may hold more runs than one page. */
  truncated: boolean;
}

/**
 * Scheduled customer-task runs created inside a window, each resolved to its
 * `scheduled_actions` id. The list endpoint omits schedule details, so each
 * run is read once more, within a time budget; a run that cannot be read is
 * counted and logged rather than holding up the rest.
 *
 * @param window - ISO bounds on the runs' `createdAt`.
 * @param window.from - Inclusive lower bound.
 * @param window.to - Upper bound.
 * @returns The runs that belong to a task, plus what could not be checked.
 */
export async function listScheduledReportRuns({
  from,
  to,
}: {
  from: string;
  to: string;
}): Promise<ScheduledReportRunList> {
  const listed = await fetchTriggerRuns(
    {
      "filter[taskIdentifier]": SCHEDULED_TASK_ID,
      "filter[createdAt][from]": from,
      "filter[createdAt][to]": to,
    },
    MAX_RUNS,
  );
  const truncated = listed.length === MAX_RUNS;
  if (truncated) {
    console.warn(`[missed-report-check] ${MAX_RUNS}+ runs in ${from}..${to}; later ones unchecked`);
  }

  let unreadable = 0;
  const resolved = await Promise.all(
    listed.map(async run => {
      try {
        const detail = await Promise.race([
          retrieveTaskRun(run.id),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("run read timed out")), READ_TIMEOUT_MS),
          ),
        ]);
        // A listed run that cannot be found is unchecked; one without a schedule
        // (a manual run) simply is not a scheduled report.
        if (!detail) throw new Error("run not found");
        const taskId = detail.schedule?.externalId;
        if (!taskId) return null;
        return { runId: run.id, taskId, createdAt: run.createdAt, status: run.status };
      } catch (error) {
        unreadable += 1;
        console.error(`[missed-report-check] could not read run ${run.id}:`, error);
        return null;
      }
    }),
  );
  return {
    runs: resolved.filter((run): run is ScheduledReportRun => run !== null),
    unreadable,
    truncated,
  };
}
