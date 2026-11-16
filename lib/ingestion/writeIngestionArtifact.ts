import { INGESTION_MAX_ARTIFACT_BYTES } from "./const";
import { hashIngestionBytes } from "./hashIngestionBytes";
import type { ArtifactStore } from "./types";

/** Create an immutable artifact, accepting an identical retry but refusing conflicting bytes. */
export async function writeIngestionArtifact(
  store: ArtifactStore,
  key: string,
  bytes: Uint8Array,
): Promise<void> {
  if (bytes.length > INGESTION_MAX_ARTIFACT_BYTES) throw new Error("Artifact size limit");
  if (await store.create(key, bytes)) return;
  const existing = await store.read(key);
  if (!existing || hashIngestionBytes(existing) !== hashIngestionBytes(bytes))
    throw new Error("Artifact conflict");
}
