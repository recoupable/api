import { createHash } from "node:crypto";
/** Digest the exact bytes, independently from their parsed meaning. */
export function hashIngestionBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
