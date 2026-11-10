import { processIngestionStep } from "./processIngestionStep";

/** Durable ingestion workflow over a captured immutable original. */
export async function ingestionWorkflow(
  actor: string,
  organization: string | undefined,
  jobId: string,
) {
  "use workflow";
  await processIngestionStep(actor, organization, jobId);
}
