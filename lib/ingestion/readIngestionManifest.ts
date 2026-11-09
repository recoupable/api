import type { ArtifactStore, IngestionManifest } from "./types";

/** Read only within the already authorized scope. Job identifiers never grant access. */
export async function readIngestionManifest(
  store: ArtifactStore,
  scope: string,
  jobId: string,
): Promise<IngestionManifest> {
  if (!/^(account|organization)\/[a-f0-9-]{36}$/.test(scope) || !/^[a-f0-9]{64}$/.test(jobId))
    throw new Error("Invalid scope");
  const bytes = await store.read(`${scope}/${jobId}/manifest.json`);
  if (!bytes) throw new Error("Ingestion job not found");
  const manifest: IngestionManifest = JSON.parse(new TextDecoder().decode(bytes));
  if (manifest.scope !== scope || manifest.job_id !== jobId)
    throw new Error("Ingestion job not found");
  return manifest;
}
