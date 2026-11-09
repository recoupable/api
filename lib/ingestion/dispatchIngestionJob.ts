import { start } from "workflow/api";
import { ingestionWorkflow } from "@/app/workflows/ingestion/ingestionWorkflow";

/** Dispatch references only; duplicate starts converge on create-only stage artifacts. */
export async function dispatchIngestionJob(
  actor: string,
  organization: string | undefined,
  jobId: string,
) {
  await start(ingestionWorkflow, [actor, organization, jobId]);
}
