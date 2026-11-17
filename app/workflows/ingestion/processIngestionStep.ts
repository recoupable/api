import { executeIngestionJob } from "@/lib/ingestion/executeIngestionJob";
import { createIngestionDependencies } from "@/lib/ingestion/createIngestionDependencies";

/** Process durable source references; private file bytes are never workflow arguments. */
export async function processIngestionStep(
  actor: string,
  organization: string | undefined,
  jobId: string,
) {
  "use step";
  if (process.env.INGESTION_ENABLED !== "true") throw new Error("Ingestion unavailable");
  await executeIngestionJob(
    actor,
    organization,
    jobId,
    createIngestionDependencies(async () => undefined),
  );
}
