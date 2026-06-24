export type ChatRunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

/**
 * Normalize a Vercel Workflow run state to the `ChatRunStatusResponse` enum
 * documented for `GET /api/chat/runs/{runId}` (recoupable/chat#1813). `pending`
 * is treated as running (matching the codebase's `RUNNING_STATUSES`). An unknown
 * string is surfaced as `running` rather than inventing a terminal state.
 *
 * @param raw - The raw `getRun(runId).status` string.
 * @returns The normalized lifecycle state.
 */
export function normalizeRunStatus(raw: string): ChatRunStatus {
  switch (raw.toLowerCase()) {
    case "queued":
      return "queued";
    case "running":
    case "pending":
      return "running";
    case "completed":
    case "complete":
    case "succeeded":
    case "success":
      return "completed";
    case "failed":
    case "errored":
    case "error":
      return "failed";
    case "cancelled":
    case "canceled":
      return "cancelled";
    default:
      return "running";
  }
}
