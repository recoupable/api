import { persistPackFoundationContext } from "./persistPackFoundationContext";
import { PackFenceError } from "../fence/PackFenceError";
import { resolvePackCreativeContext } from "../resolvePackCreativeContext";
import { bindPackFoundationDependents } from "./bindPackFoundationDependents";
import { getPackFoundationReferences } from "./getPackFoundationReferences";
import { packFoundationRecordSchema, type PackFoundationSelection } from "./packFoundationSchema";
import type { PackActor } from "../packTypes";
import type { PackFoundationServices, PackFoundationBatchState } from "./packFoundationServices";
/** Prepare and persist the foundation barrier before returning scheduler-eligible IDs. */
export async function preparePackFoundationBatch(
  actor: PackActor,
  jobId: string,
  selection: PackFoundationSelection,
  services: PackFoundationServices,
  state: PackFoundationBatchState,
) {
  const { prepare, read, persist, produce, createPlan, bindFiles } = services;
  const original = await read(actor, jobId);
  state.savedJob = original.job;
  if (original.job.id !== jobId || original.job.status !== "running")
    throw new Error("Foundation batch requires the admitted running pack");
  const plan = await createPlan(original, selection);
  const context = original.job.production_context as { shared_foundation?: unknown } | undefined;
  const saved =
    context?.shared_foundation === undefined
      ? undefined
      : packFoundationRecordSchema.parse(context.shared_foundation);
  if (saved && saved.plan.digest !== plan.digest)
    throw new Error("Saved foundation plan no longer matches the quote and direction");
  bindPackFoundationDependents(original, plan, saved);
  state.foundation = saved ?? { plan, state: "pending", files: [] };
  const asset = original.assets.find(a => a.id === plan.asset_id);
  if (saved?.state === "ready" && asset?.status !== "completed")
    throw new Error("Retained foundation outcome changed; no regeneration authorized");
  const originalReferences =
    original.job.quote?.sources?.references.length ??
    resolvePackCreativeContext(original.job.brief).reference_image_urls.length;
  if (plan.dependent_asset_ids.length && asset?.status === "pending" && originalReferences >= 5) {
    state.foundation.blocked_reason = "reference_limit";
    await persist(actor, original.job, state.foundation);
    throw new Error("Choose the pack reference scope before generating its foundation");
  }
  const prepared = await prepare(actor, jobId);
  if (
    prepared.job.id !== jobId ||
    prepared.job.revision !== plan.revision ||
    prepared.job.quote?.id !== plan.quote_id
  )
    throw new Error("Prepared pack identity changed");
  let acknowledgedJob = prepared.job;
  if (
    actor.packProtocol === 2 &&
    saved &&
    prepared.job.context_version !== original.job.context_version
  )
    throw new PackFenceError("Foundation context changed during preparation");
  if (!saved) {
    if (
      actor.packProtocol === 2 &&
      (prepared.job.production_context as { shared_foundation?: unknown } | null)
        ?.shared_foundation !== undefined
    )
      throw new PackFenceError("Foundation context changed during preparation");
    acknowledgedJob = await persistPackFoundationContext(
      actor,
      actor.packProtocol === 2
        ? { ...original.job, context_version: prepared.job.context_version }
        : original.job,
      state.foundation,
      services,
    );
  }
  if (asset?.status === "pending") await produce(actor, prepared.job, asset.id);
  const current = await read(actor, jobId);
  if (actor.packProtocol === 2 && current.job.context_version !== acknowledgedJob.context_version)
    throw new PackFenceError("Foundation context changed after acknowledgement");
  state.savedJob = current.job;
  if ((await createPlan(current, selection)).digest !== plan.digest)
    throw new Error("Foundation plan changed during preparation");
  const bound = await bindFiles(
    plan,
    current.assets.find(a => a.id === plan.asset_id),
  );
  if (
    saved?.state === "ready" &&
    (bound.state !== "ready" || bound.asset_sha256 !== saved.asset_sha256)
  )
    throw new Error("Retained foundation bytes or asset version changed");
  if (bound.state === "ready")
    bound.dependency_bindings = bindPackFoundationDependents(current, plan, saved);
  state.foundation = bound;
  const persistedJob = await persistPackFoundationContext(
    actor,
    actor.packProtocol === 2
      ? { ...current.job, context_version: acknowledgedJob.context_version }
      : current.job,
    bound,
    services,
  );
  state.savedJob = persistedJob;
  const pending = new Set(current.assets.filter(a => a.status === "pending").map(a => a.id));
  state.references = await getPackFoundationReferences(
    actor,
    persistedJob,
    prepared.job,
    bound,
    plan.dependent_asset_ids.some(id => pending.has(id)),
    services,
  );
  state.blockedAssetIds = plan.dependent_asset_ids.filter(
    id => pending.has(id) && bound.state !== "ready",
  );
  state.settlementDeferred =
    state.blockedAssetIds.length > 0 || current.assets.some(a => a.status === "running");
  return {
    job: prepared.job,
    assetIds: prepared.assetIds.filter(
      id => pending.has(id) && !state.blockedAssetIds.includes(id),
    ),
  };
}
