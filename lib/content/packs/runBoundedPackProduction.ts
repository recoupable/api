import type { PackLaunchFence } from "@/lib/content/packs/fence/packFenceTypes";
import { assertPackExecutionIdentity } from "@/lib/content/packs/fence/assertPackExecutionIdentity";
import { isPackFenceError } from "@/lib/content/packs/fence/isPackFenceError";
import { PackFenceError } from "@/lib/content/packs/fence/PackFenceError";
import type { PackActor, PackJob } from "./packTypes";

type PackBatchServices = {
  prepare: (
    actor: PackActor,
    jobId: string,
    execution?: PackLaunchFence,
  ) => Promise<{ job: PackJob; assetIds: string[]; assetAttempts?: Record<string, number> }>;
  produce: (
    actor: PackActor,
    job: PackJob,
    assetId: string,
    resume?: boolean,
    expectedAttempt?: number,
  ) => Promise<unknown>;
  settle: (
    actor: PackActor,
    jobId: string,
    error?: string,
    execution?: PackLaunchFence,
  ) => Promise<unknown>;
};

/**
 * Unwired candidate: supply a qualified bound, durable asset steps, and no-retry settlement.
 * A bound limits this invocation, not separate workflow runs or provider capacity.
 * No retries, reservations, provider adapters, or production policy are introduced.
 */
export async function runBoundedPackProduction(
  actor: PackActor,
  jobId: string,
  concurrency: number,
  services: PackBatchServices,
  execution?: PackLaunchFence,
): Promise<{ job_id: string; error?: string; failed_asset_ids?: string[] }> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1)
    throw new Error("Pack concurrency must be a positive safe integer");

  if (actor.packProtocol === 2 && !execution)
    throw new PackFenceError("Scheduler requires original execution admission");
  // Workflow serializes a method call receiver; never pass the services object as this.
  const { prepare, produce, settle } = services;
  const failedAssetIds: string[] = [];
  let stopped = false;
  let failure: unknown;
  try {
    const prepared =
      actor.packProtocol === 2
        ? await prepare(actor, jobId, execution)
        : await prepare(actor, jobId);
    if (actor.packProtocol === 2) assertPackExecutionIdentity(prepared.job, execution);
    const assetIds = [...new Set(prepared.assetIds)];
    let next = 0;
    async function worker() {
      while (!stopped && next < assetIds.length) {
        const assetId = assetIds[next++];
        try {
          if (actor.packProtocol === 2)
            await produce(actor, prepared.job, assetId, false, prepared.assetAttempts?.[assetId]);
          else await produce(actor, prepared.job, assetId);
        } catch (error) {
          failedAssetIds.push(assetId);
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

  if ((actor.packProtocol === 2 && stopped) || isPackFenceError(failure)) throw failure;
  // Outside the catch: a lost settlement acknowledgement must not invoke it again.
  await settle(
    actor,
    jobId,
    stopped ? (failure instanceof Error ? failure.message : "Pack workflow failed") : undefined,
    ...(actor.packProtocol === 2 && execution ? [execution] : []),
  );
  return stopped
    ? {
        job_id: jobId,
        error: "Pack stopped; inspect saved status and outputs before retrying",
        failed_asset_ids: failedAssetIds,
      }
    : { job_id: jobId };
}
