import { assertPackExecutionIdentity } from "../fence/assertPackExecutionIdentity";
import { getPackLaunchFence } from "../fence/getPackLaunchFence";
import { PackFenceError } from "../fence/PackFenceError";
import type { PackActor, PackJob } from "../packTypes";
import type { PackFoundationRecord } from "./packFoundationSchema";
import type { PackFoundationServices } from "./packFoundationServices";
/** Advance only from an acknowledged write, never from a later unrelated read. */
export async function persistPackFoundationContext(
  actor: PackActor,
  job: PackJob,
  record: PackFoundationRecord,
  services: PackFoundationServices,
): Promise<PackJob> {
  const { persist } = services;
  const saved = await persist(actor, job, record);
  if (actor.packProtocol !== 2) return job;
  if (
    !saved ||
    !Number.isSafeInteger(job.context_version) ||
    saved.context_version !== job.context_version! + 1
  )
    throw new PackFenceError("Foundation context acknowledgement unavailable");
  assertPackExecutionIdentity(saved, getPackLaunchFence(job), job.workflow_run_id ?? undefined);
  return saved;
}
