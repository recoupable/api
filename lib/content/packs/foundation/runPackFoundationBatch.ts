import type { PackLaunchFence } from "../fence/packFenceTypes";
import { getPackFoundationContinuation } from "./getPackFoundationContinuation";
import { preparePackFoundationBatch } from "./preparePackFoundationBatch";
import { runBoundedPackProduction } from "../runBoundedPackProduction";
import type { PackFoundationSelection } from "./packFoundationSchema";
import type { PackActor } from "../packTypes";
import type { PackFoundationServices, PackFoundationBatchState } from "./packFoundationServices";
/** Unwired no-new-item composition. Deferred settlement preserves blocked pending work. */
export async function runPackFoundationBatch(
  actor: PackActor,
  jobId: string,
  concurrency: number,
  selection: PackFoundationSelection,
  services: PackFoundationServices,
  execution?: PackLaunchFence,
) {
  const { produce, settle } = services;
  const state: PackFoundationBatchState = {
    blockedAssetIds: [],
    settlementDeferred: true,
    references: [],
  };
  const result = await runBoundedPackProduction(
    actor,
    jobId,
    concurrency,
    {
      prepare: () => preparePackFoundationBatch(actor, jobId, selection, services, state),
      produce: async (stepActor, job, assetId) => {
        if (state.foundation?.plan.dependent_asset_ids.includes(assetId)) {
          if (state.foundation.state !== "ready")
            throw new Error("Foundation dependency is not ready");
          job = {
            ...job,
            brief: { ...job.brief, reference_image_urls: state.references },
            shared_foundation_binding: {
              plan_sha256: state.foundation.plan.digest,
              asset_sha256: state.foundation.asset_sha256,
            },
          };
        }
        return produce(stepActor, job, assetId);
      },
      settle: async (stepActor, id, error) => {
        if (!state.settlementDeferred) await settle(stepActor, id, error);
      },
    },
    execution,
  );
  const continuation = getPackFoundationContinuation(
    state.foundation,
    state.savedJob,
    state.settlementDeferred,
    result.error,
  );
  return {
    ...result,
    status: continuation.status,
    foundation: state.foundation,
    blockedAssetIds: state.blockedAssetIds,
    settlementDeferred: state.settlementDeferred,
    continuation,
  };
}
