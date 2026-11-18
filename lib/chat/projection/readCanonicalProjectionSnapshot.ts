import type { getWorld } from "workflow/runtime";
import { hydrateProjectionEvidence } from "./hydrateProjectionEvidence";
import { readProjectionEvidence } from "./readProjectionEvidence";
import { ProjectionEvidenceError } from "./ProjectionEvidenceError";
type World = Pick<
  ReturnType<typeof getWorld>,
  "runs" | "getEncryptionKeyForRun" | "getStreamInfo" | "getStreamChunks" | "listStreamsByRunId"
>;
/** Validate raw stored frames, not an EOF from the SDK's tolerant stream decoder. */
export async function readCanonicalProjectionSnapshot(
  world: World,
  runId: string,
  signal: AbortSignal,
): Promise<unknown[]> {
  signal = AbortSignal.any([signal, AbortSignal.timeout(5000)]);
  const read = <T>(operation: () => Promise<T>) => readProjectionEvidence(operation, signal);
  // Installed core4.2.4 getWorkflowRunStreamId default-name contract. Confirm
  // membership in this run; the compiled installed-SDK fixture guards drift.
  const name = `${runId.replace("wrun_", "strm_")}_user`;
  const names = await read(() => world.listStreamsByRunId(runId));
  if (!names.includes(name)) throw new ProjectionEvidenceError("evidence_missing");
  const info = await read(() => world.getStreamInfo(name, runId));
  if (!Number.isSafeInteger(info.tailIndex) || info.tailIndex < -1 || info.tailIndex >= 10000)
    throw new ProjectionEvidenceError("evidence_limit");
  const chunks: unknown[] = [];
  let cursor: string | undefined;
  let remaining = 16_777_216;
  for (let pageCount = 0; chunks.length <= info.tailIndex && pageCount < 100; pageCount++) {
    const page = await read(() => world.getStreamChunks(name, runId, { limit: 100, cursor }));
    for (const chunk of page.data) {
      if (chunks.length > info.tailIndex) break;
      if (chunk.index !== chunks.length) throw new ProjectionEvidenceError("canonical_mismatch");
      const bytes = chunk.data;
      if (!(bytes instanceof Uint8Array) || bytes.length < 8)
        throw new ProjectionEvidenceError("invalid_evidence");
      remaining -= bytes.length;
      if (remaining < 0) throw new ProjectionEvidenceError("evidence_limit");
      const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
        0,
        false,
      );
      const prefix = new TextDecoder().decode(bytes.subarray(4, 8));
      // One current-SDK object frame per indexed stored chunk. Do not accept
      // trailing bytes, partial frames, legacy unframed data or silent decoder loss.
      if (size !== bytes.length - 4 || (prefix !== "devl" && prefix !== "encr"))
        throw new ProjectionEvidenceError("invalid_evidence");
      chunks.push(await hydrateProjectionEvidence(bytes.subarray(4), runId, world, signal));
    }
    if (chunks.length > info.tailIndex) return chunks;
    if (!page.hasMore) throw new ProjectionEvidenceError("proof_pending");
    if (!page.cursor || page.cursor === cursor)
      throw new ProjectionEvidenceError("invalid_evidence");
    cursor = page.cursor;
  }
  if (chunks.length <= info.tailIndex) throw new ProjectionEvidenceError("evidence_limit");
  return chunks;
}
