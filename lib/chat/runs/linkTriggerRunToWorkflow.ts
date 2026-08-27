import { retrieveTaskRun } from "@/lib/trigger/retrieveTaskRun";
import { updateTriggerRunMetadata } from "@/lib/trigger/updateTriggerRunMetadata";

interface LinkTriggerRunToWorkflowInput {
  triggerRunId: string;
  /** The authenticated account; the Trigger run must carry its `account:` tag. */
  accountId: string;
  sessionId: string;
  chatId: string;
  workflowRunId: string;
}

/**
 * Writes the ids of the work a scheduled task kicked off back onto its
 * Trigger.dev run (chat#2006 item 4a). The Trigger run itself finishes in
 * seconds; this metadata is the only link from it to the chat + workflow
 * that produce the output, and the run page reads it via
 * `GET /api/tasks/runs?runId=`.
 *
 * The write is project-scoped on Trigger's side, so the run is checked for
 * the caller's `account:<id>` tag first (customerPromptTask adds it): a
 * caller cannot stamp a false link onto another account's run. Best-effort
 * throughout: every failure is logged, never thrown.
 */
export async function linkTriggerRunToWorkflow({
  triggerRunId,
  accountId,
  sessionId,
  chatId,
  workflowRunId,
}: LinkTriggerRunToWorkflowInput): Promise<void> {
  let owned = false;
  try {
    const run = await retrieveTaskRun(triggerRunId);
    const tags = (run as { tags?: unknown } | null)?.tags;
    owned = Array.isArray(tags) && tags.includes(`account:${accountId}`);
  } catch (error) {
    console.error("[linkTriggerRunToWorkflow] could not retrieve Trigger run:", {
      triggerRunId,
      error,
    });
  }
  if (!owned) {
    console.error(
      "[linkTriggerRunToWorkflow] Trigger run is not tagged for this account; not linking:",
      {
        triggerRunId,
        accountId,
      },
    );
    return;
  }

  const linked = await updateTriggerRunMetadata(triggerRunId, { sessionId, chatId, workflowRunId });
  if (!linked) {
    console.error("[linkTriggerRunToWorkflow] could not link Trigger run to workflow:", {
      triggerRunId,
      workflowRunId,
    });
  }
}
