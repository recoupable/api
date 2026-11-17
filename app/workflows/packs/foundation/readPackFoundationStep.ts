import { getWorkflowMetadata } from "workflow";
import { readAdmittedPackSnapshot } from "@/lib/content/packs/foundation/readAdmittedPackSnapshot";
import type { PackActor } from "@/lib/content/packs/packTypes";
export async function readPackFoundationStep(actor: PackActor, jobId: string) {
  "use step";
  return readAdmittedPackSnapshot(actor, jobId, getWorkflowMetadata().workflowRunId);
}
readPackFoundationStep.maxRetries = 0;
