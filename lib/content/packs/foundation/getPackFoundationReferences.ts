import { packProductionContextSchema } from "../packProductionContextSchema";
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
  const context = packProductionContextSchema.parse(savedJob.production_context);
  // preparePackProduction signs this retained reference list in order. Only use
  // its identity mapping when the prepared list has the same cardinality.
  const retainedKeys = new Set(
    context.references.length === preparedJob.brief.reference_image_urls.length
      ? context.references.map(file => file.storage_key)
      : [],
  );
  const additionalFiles = record.files.filter(file => !retainedKeys.has(file.storage_key));
  const references = [
    ...new Set([
      ...preparedJob.brief.reference_image_urls,
      ...(await Promise.all(additionalFiles.map(signFile))),
    ]),
  ];
  if (references.length > 5) {
    record.blocked_reason = "reference_limit";
    await persist(actor, savedJob, record);
    throw new Error("Foundation exceeds the pack reference limit");
  }
  return references;
}
