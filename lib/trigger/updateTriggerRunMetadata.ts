/**
 * Writes key/value metadata onto a Trigger.dev run from outside the run
 * (`PUT /api/v1/runs/{runId}/metadata`). Used to link a scheduled task's
 * Trigger run to the chat + workflow run that did the work (chat#2006
 * item 4a) — `GET /api/tasks/runs?runId=` then returns it as `metadata`.
 *
 * Best-effort by design: returns false on any failure and never throws,
 * so a missing link costs observability, not the run.
 *
 * @param runId - The Trigger.dev run id (`run_…`)
 * @param metadata - Flat key/value pairs to merge onto the run's metadata
 * @returns true when Trigger.dev accepted the write
 */
export async function updateTriggerRunMetadata(
  runId: string,
  metadata: Record<string, string>,
): Promise<boolean> {
  const apiKey = process.env.TRIGGER_SECRET_KEY;
  if (!apiKey) {
    console.error("[updateTriggerRunMetadata] Missing TRIGGER_SECRET_KEY");
    return false;
  }

  try {
    const response = await fetch(`https://api.trigger.dev/api/v1/runs/${runId}/metadata`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ metadata }),
    });
    if (!response.ok) {
      console.error(`[updateTriggerRunMetadata] ${runId}: Trigger.dev ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[updateTriggerRunMetadata] ${runId}:`, error);
    return false;
  }
}
