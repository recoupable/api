import { getWorkflowMetadata } from "workflow";
import { readAdmittedPackSnapshot } from "@/lib/content/packs/foundation/readAdmittedPackSnapshot";
import { savePackFoundationRecord } from "@/lib/content/packs/foundation/savePackFoundationRecord";
import type { PackActor, PackJob } from "@/lib/content/packs/packTypes";
import type { PackFoundationRecord } from "@/lib/content/packs/foundation/packFoundationSchema";
export async function persistPackFoundationStep(
  actor: PackActor,
  job: PackJob,
  record: PackFoundationRecord,
) {
  "use step";
  await readAdmittedPackSnapshot(actor, job.id, getWorkflowMetadata().workflowRunId);
  return savePackFoundationRecord(actor, job, record);
}
persistPackFoundationStep.maxRetries = 0;
