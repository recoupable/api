import type { PackSnapshot } from "../packTypes";
import type { PackFoundationPlan, PackFoundationRecord } from "./packFoundationSchema";
/** Durable intent for the original attempt; never attach a new foundation to preexisting work. */
export function bindPackFoundationDependents(
  snapshot: PackSnapshot,
  plan: PackFoundationPlan,
  saved?: PackFoundationRecord,
) {
  return plan.dependent_asset_ids.map(id => {
    const asset = snapshot.assets.find(a => a.id === id);
    if (!asset) throw new Error("Foundation dependent asset disappeared");
    if (
      asset.status === "pending" &&
      asset.attempt === 0 &&
      !Object.keys(asset.provider_state).length &&
      !asset.files.length
    )
      return { asset_id: id, attempt: 1 };
    const prior =
      saved?.state === "ready" && saved.plan.digest === plan.digest
        ? saved.dependency_bindings?.find(binding => binding.asset_id === id)
        : undefined;
    if (!prior || asset.status === "pending" || asset.attempt !== prior.attempt)
      throw new Error(
        "Retained dependent production has no matching durable foundation binding; reconcile without regeneration",
      );
    return prior;
  });
}
