import { getRun } from "workflow/api";

/** Cap on how long to wait for a workflow run to reach a terminal status. */
const TERMINAL_WAIT_TIMEOUT_MS = 8000;
/** Poll interval while waiting for terminal status. */
const TERMINAL_WAIT_INTERVAL_MS = 100;

const TERMINAL_STATUSES: ReadonlySet<string> = new Set(["cancelled", "completed", "failed"]);

/**
 * Block until the workflow run reaches a terminal status (`cancelled` /
 * `completed` / `failed`), polling `getRun(runId).status`. Transient probe
 * errors are swallowed and retried until the deadline.
 *
 * @param runId - The workflow run id to poll.
 * @returns true when the run reached a terminal status, false on timeout.
 */
export async function waitForTerminalRunStatus(runId: string): Promise<boolean> {
  const deadline = Date.now() + TERMINAL_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const status = await getRun(runId).status;
      if (TERMINAL_STATUSES.has(status)) return true;
    } catch {
      // Transient errors: swallow and retry until the deadline.
    }
    await new Promise<void>(resolve => setTimeout(resolve, TERMINAL_WAIT_INTERVAL_MS));
  }
  return false;
}
