import { ingestionCompletionSchema } from "./ingestionCompletionSchema";
import type { IngestionManifest } from "./types";
/** Validate private stored metadata before it can drive shared publication or artifact selection. */
export function readIngestionCompletion(bytes: Uint8Array, manifest: IngestionManifest) {
  try {
    const result = ingestionCompletionSchema.parse(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    );
    if (
      result.job_id !== manifest.job_id ||
      result.source_sha256 !== manifest.bronze_sha256 ||
      result.engine_version !== manifest.engine_version
    )
      throw new Error("Completion does not match manifest");
    return result;
  } catch {
    throw new Error("Invalid ingestion completion");
  }
}
