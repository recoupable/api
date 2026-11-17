import { packProductionContextSchema } from "../packProductionContextSchema";
import { runPackCommand } from "@/lib/supabase/release_pack_jobs/runPackCommand";
import { createPackFoundationPlan } from "./createPackFoundationPlan";
import { packFoundationRecordSchema, type PackFoundationRecord } from "./packFoundationSchema";
import type { PackActor, PackJob } from "../packTypes";
/** Unwired context adapter; single admitted workflow only, not a new lease or budget action. */
export async function savePackFoundationRecord(
  actor: PackActor,
  job: PackJob,
  input: PackFoundationRecord,
) {
  const record = packFoundationRecordSchema.parse(input);
  const current = await runPackCommand(actor, "read", job.id);
  const plan = createPackFoundationPlan(current, {
    ...(record.plan.selection === "explicit" ? { foundationAssetId: record.plan.asset_id! } : {}),
    dependentAssetIds: record.plan.dependent_asset_ids,
  });
  if (
    current.job.status !== "running" ||
    current.job.owner_id !== job.owner_id ||
    plan.digest !== record.plan.digest
  )
    throw new Error("Foundation quote, direction or admitted job changed");
  const context = current.job.production_context ?? {};
  if (
    typeof context !== "object" ||
    Array.isArray(context) ||
    (!packProductionContextSchema.safeParse(context).success &&
      !(record.blocked_reason === "reference_limit" && record.state === "pending"))
  )
    throw new Error("Persist foundation only after retained shared preparation completes");
  await runPackCommand(actor, "context", job.id, {
    value: { ...context, shared_foundation: record },
  });
}
