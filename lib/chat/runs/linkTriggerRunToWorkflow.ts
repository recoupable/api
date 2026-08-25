import { updateTriggerRunMetadata } from "@/lib/trigger/updateTriggerRunMetadata";

interface LinkTriggerRunToWorkflowInput {
  triggerRunId: string;
  sessionId: string;
  chatId: string;
  workflowRunId: string;
}

/**
 * Writes the ids of the work a scheduled task kicked off back onto its
 * Trigger.dev run (chat#2006 item 4a). The Trigger run itself finishes in
 * seconds; this metadata is the only link from it to the chat + workflow
 * that produce the output, and the run page reads it via
 * `GET /api/tasks/runs?runId=`. Best-effort: a failed write is logged, never
 * thrown, so it costs observability rather than the run.
 */
export async function linkTriggerRunToWorkflow({
  triggerRunId,
  sessionId,
  chatId,
  workflowRunId,
}: LinkTriggerRunToWorkflowInput): Promise<void> {
  const linked = await updateTriggerRunMetadata(triggerRunId, {
    sessionId,
    chatId,
    workflowRunId,
  });
  if (!linked) {
    console.error("[linkTriggerRunToWorkflow] could not link Trigger run to workflow:", {
      triggerRunId,
      workflowRunId,
    });
  }
}
