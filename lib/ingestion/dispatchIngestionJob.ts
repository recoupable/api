import { start } from "workflow/api";
import { ingestionWorkflow } from "@/app/workflows/ingestion/ingestionWorkflow";
import { claimIngestionDispatch } from "./claimIngestionDispatch";

/** Dispatch references only; suppress retries while a job holds its dispatch lease. */
export async function dispatchIngestionJob(
  actor: string,
  organization: string | undefined,
  jobId: string,
) {
  if (!(await claimIngestionDispatch(jobId))) return;
  await start(ingestionWorkflow, [actor, organization, jobId]);
}
