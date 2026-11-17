import type { PackActor, PackJob } from "./packTypes";

type PackBatchServices = {
  prepare: (actor: PackActor, jobId: string) => Promise<{ job: PackJob; assetIds: string[] }>;
  produce: (actor: PackActor, job: PackJob, assetId: string) => Promise<unknown>;
  settle: (actor: PackActor, jobId: string, error?: string) => Promise<unknown>;
};

/**
 * Unwired candidate: callers supply a qualified bound and existing durable steps.
 * A bound limits this invocation, not separate workflow runs or provider capacity.
 * No retries, reservations, provider adapters, or production policy are introduced.
 */
export async function runBoundedPackProduction(
  actor: PackActor,
  jobId: string,
  concurrency: number,
  services: PackBatchServices,
): Promise<{ job_id: string; error?: string }> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1)
    throw new Error("Pack concurrency must be a positive safe integer");

  let stopped = false;
  let failure: unknown;
  try {
    const prepared = await services.prepare(actor, jobId);
    const assetIds = [...new Set(prepared.assetIds)];
    let next = 0;
    async function worker() {
      while (!stopped && next < assetIds.length) {
        const assetId = assetIds[next++];
        try {
          await services.produce(actor, prepared.job, assetId);
        } catch (error) {
          if (!stopped) failure = error;
          stopped = true;
        }
      }
    }
    // Workers absorb step rejection so Promise.all cannot settle the pack early.
    await Promise.all(Array.from({ length: Math.min(concurrency, assetIds.length) }, worker));
  } catch (error) {
    stopped = true;
    failure = error;
  }

  // Outside the catch: a lost settlement acknowledgement must not invoke it again.
  await services.settle(
    actor,
    jobId,
    stopped ? (failure instanceof Error ? failure.message : "Pack workflow failed") : undefined,
  );
  return stopped
    ? { job_id: jobId, error: "Pack stopped; inspect saved status and outputs before retrying" }
    : { job_id: jobId };
}
