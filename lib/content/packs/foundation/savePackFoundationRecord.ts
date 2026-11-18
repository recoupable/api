import { getPackExecutionFence } from "../fence/getPackExecutionFence";
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
    (job.protocol === 2 &&
      (current.job.execution_id !== job.execution_id ||
        current.job.execution_version !== job.execution_version ||
        current.job.workflow_run_id !== job.workflow_run_id)) ||
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
    ...getPackExecutionFence(job),
    ...(job.protocol === 2 ? { context_version: current.job.context_version } : {}),
    value: { ...context, shared_foundation: record },
  });
}
