import { getWorkflowMetadata } from "workflow";
/** Journal this start clock once; replay must never reset the candidate deadline. */
export async function startPackAdmissionStep() {
  "use step";
  return { workflowRunId: getWorkflowMetadata().workflowRunId, startedAt: Date.now() };
}
startPackAdmissionStep.maxRetries = 0;
