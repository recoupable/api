import { bindPackFoundationDependents } from "./bindPackFoundationDependents";
import { getPackFoundationContinuation } from "./getPackFoundationContinuation";
import { runBoundedPackProduction } from "../runBoundedPackProduction";
import { createPackFoundationPlan } from "./createPackFoundationPlan";
import { bindPackFoundationFiles } from "./bindPackFoundationFiles";
import {
  packFoundationRecordSchema,
  type PackFoundationRecord,
  type PackFoundationSelection,
} from "./packFoundationSchema";
import type { PackActor, PackJob } from "../packTypes";
import type { PackFoundationServices } from "./packFoundationServices";
/** Unwired no-new-item composition. Deferred settlement preserves blocked pending work. */
export async function runPackFoundationBatch(
  actor: PackActor,
  jobId: string,
  concurrency: number,
  selection: PackFoundationSelection,
  services: PackFoundationServices,
) {
  const { prepare, read, persist, produce, readFile, signFile, settle } = services;
  let savedJob: PackJob | undefined;
  let foundation: PackFoundationRecord | undefined;
  let blockedAssetIds: string[] = [];
  let settlementDeferred = true;
  let references: string[] = [];
  const result = await runBoundedPackProduction(actor, jobId, concurrency, {
    prepare: async () => {
      const original = await read(actor, jobId);
      savedJob = original.job;
      if (original.job.id !== jobId || original.job.status !== "running")
        throw new Error("Foundation batch requires the admitted running pack");
      const plan = createPackFoundationPlan(original, selection);
      const context = original.job.production_context as
        | { shared_foundation?: unknown }
        | undefined;
      const saved =
        context?.shared_foundation === undefined
          ? undefined
          : packFoundationRecordSchema.parse(context.shared_foundation);
      if (saved && saved.plan.digest !== plan.digest)
        throw new Error("Saved foundation plan no longer matches the quote and direction");
      bindPackFoundationDependents(original, plan, saved);
      foundation = saved ?? { plan, state: "pending", files: [] };
      const prepared = await prepare(actor, jobId);
      if (
        prepared.job.id !== jobId ||
        prepared.job.revision !== plan.revision ||
        prepared.job.quote?.id !== plan.quote_id
      )
        throw new Error("Prepared pack identity changed");
      if (!saved) await persist(actor, original.job, foundation);
      const asset = original.assets.find(a => a.id === plan.asset_id);
      if (saved?.state === "ready" && asset?.status !== "completed")
        throw new Error("Retained foundation outcome changed; no regeneration authorized");
      if (asset?.status === "pending") await produce(actor, prepared.job, asset.id);
      const current = await read(actor, jobId);
      savedJob = current.job;
      if (createPackFoundationPlan(current, selection).digest !== plan.digest)
        throw new Error("Foundation plan changed during preparation");
      const bound = await bindPackFoundationFiles(
        plan,
        current.assets.find(a => a.id === plan.asset_id),
        readFile,
      );
      if (
        saved?.state === "ready" &&
        (bound.state !== "ready" || bound.asset_sha256 !== saved.asset_sha256)
      )
        throw new Error("Retained foundation bytes or asset version changed");
      if (bound.state === "ready")
        bound.dependency_bindings = bindPackFoundationDependents(current, plan, saved);
      foundation = bound;
      await persist(actor, current.job, bound);
      if (bound.state === "ready") {
        references = [
          ...new Set([
            ...prepared.job.brief.reference_image_urls,
            ...(await Promise.all(bound.files.map(signFile))),
          ]),
        ];
        if (references.length > 10)
          throw new Error("Foundation exceeds the existing image adapter reference limit");
      }
      const pending = new Set(current.assets.filter(a => a.status === "pending").map(a => a.id));
      blockedAssetIds = plan.dependent_asset_ids.filter(
        id => pending.has(id) && bound.state !== "ready",
      );
      settlementDeferred =
        blockedAssetIds.length > 0 || current.assets.some(a => a.status === "running");
      return {
        job: prepared.job,
        assetIds: prepared.assetIds.filter(id => pending.has(id) && !blockedAssetIds.includes(id)),
      };
    },
    produce: async (stepActor, job, assetId) => {
      if (foundation?.plan.dependent_asset_ids.includes(assetId)) {
        if (foundation.state !== "ready") throw new Error("Foundation dependency is not ready");
        job = {
          ...job,
          brief: { ...job.brief, reference_image_urls: references },
          shared_foundation_binding: {
            plan_sha256: foundation.plan.digest,
            asset_sha256: foundation.asset_sha256,
          },
        };
      }
      return produce(stepActor, job, assetId);
    },
    settle: async (stepActor, id, error) => {
      if (!settlementDeferred) await settle(stepActor, id, error);
    },
  });
  const continuation = getPackFoundationContinuation(
    foundation,
    savedJob,
    settlementDeferred,
    result.error,
  );
  return {
    ...result,
    status: continuation.status,
    foundation,
    blockedAssetIds,
    settlementDeferred,
    continuation,
  };
}
