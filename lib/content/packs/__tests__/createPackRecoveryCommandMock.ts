import type { runPackCommand } from "@/lib/supabase/release_pack_jobs/runPackCommand";
import type { PackActor, PackSnapshot } from "../packTypes";
/** In-memory persistence with enforced targets; not a production accounting simulation. */
export function createPackRecoveryCommandMock(
  saved: PackSnapshot,
  expectedActor: PackActor,
): typeof runPackCommand {
  return async (actor, command, jobId, input = {}) => {
    if (
      actor.accountId !== expectedActor.accountId ||
      actor.organizationId !== expectedActor.organizationId
    )
      throw new Error("Unexpected actor");
    if (jobId !== saved.job.id) throw new Error("Unexpected job");
    if (command === "phase" || command === "finish_asset") {
      const target = saved.assets.find(
        asset => asset.id === input.asset_id && asset.job_id === jobId,
      );
      if (!target) throw new Error("Unexpected asset");
      if (command === "phase") {
        if (typeof input.phase !== "string") throw new Error("Missing phase");
        target.provider_state[input.phase] = structuredClone(input.value);
      } else Object.assign(target, structuredClone(input));
    } else if (command === "settle") {
      const target = saved.assets.find(asset => asset.id === "asset");
      const receipt = target?.provider_state.image_submission_0;
      if (
        target?.status !== "completed" ||
        typeof receipt !== "object" ||
        !receipt ||
        !("charge_credits" in receipt) ||
        receipt.charge_credits !== 73
      )
        throw new Error("Recovery did not complete the original asset and receipt");
      saved.job.held_credits = 0;
      saved.job.consumed_credits = 73;
    } else if (command !== "run" && command !== "read")
      throw new Error(`Unexpected command ${command}`);
    return structuredClone(saved);
  };
}
