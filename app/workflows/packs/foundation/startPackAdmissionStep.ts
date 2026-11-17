import { getWorkflowMetadata } from "workflow";
/** After this result is durably completed, replay preserves its candidate deadline. */
export async function startPackAdmissionStep() {
  "use step";
  return { workflowRunId: getWorkflowMetadata().workflowRunId, startedAt: Date.now() };
}
startPackAdmissionStep.maxRetries = 0;
