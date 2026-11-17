import type { PackActor, PackJob } from "../packTypes";
import type { PackFoundationRecord } from "./packFoundationSchema";
import type { PackFoundationServices } from "./packFoundationServices";
/** Refresh URLs only for pending dependents; preserve original inputs and the pack limit. */
export async function getPackFoundationReferences(
  actor: PackActor,
  savedJob: PackJob,
  preparedJob: PackJob,
  record: PackFoundationRecord,
  hasPendingDependents: boolean,
  services: PackFoundationServices,
) {
  if (record.state !== "ready" || !hasPendingDependents) return [];
  const { signFile, persist } = services;
  const references = [
    ...new Set([
      ...preparedJob.brief.reference_image_urls,
      ...(await Promise.all(record.files.map(signFile))),
    ]),
  ];
  if (references.length > 5) {
    record.blocked_reason = "reference_limit";
    await persist(actor, savedJob, record);
    throw new Error("Foundation exceeds the pack reference limit");
  }
  return references;
}
