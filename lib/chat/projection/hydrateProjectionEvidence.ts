import {
  hydrateDataWithKey,
  isEncryptedData,
  isExpiredStub,
} from "@workflow/core/serialization-format";
import { importKey } from "@workflow/core/encryption";
import { observabilityRevivers } from "workflow/observability";
import type { getWorld } from "workflow/runtime";
import { ProjectionEvidenceError } from "./ProjectionEvidenceError";
import { readProjectionEvidence } from "./readProjectionEvidence";
type World = Pick<ReturnType<typeof getWorld>, "runs" | "getEncryptionKeyForRun">;
function readResolvedRun(world: World, runId: string) {
  return world.runs.get(runId, { resolveData: "all" });
}
/** Existing configured-World decryption only; never manufacture or accept a caller key. */
export async function hydrateProjectionEvidence(
  value: unknown,
  runId: string,
  world: World,
  signal: AbortSignal,
  resolvedRun?: Awaited<ReturnType<typeof readResolvedRun>>,
) {
  const encrypted = isEncryptedData(value);
  let key;
  if (encrypted) {
    const run =
      resolvedRun ?? (await readProjectionEvidence(() => readResolvedRun(world, runId), signal));
    const rawKey = await readProjectionEvidence(
      async () => world.getEncryptionKeyForRun?.(run),
      signal,
    );
    if (!rawKey) throw new ProjectionEvidenceError("key_unavailable");
    try {
      key = await importKey(rawKey);
    } catch {
      throw new ProjectionEvidenceError("decryption_failed");
    }
  }
  let hydrated;
  try {
    hydrated = await hydrateDataWithKey(value, observabilityRevivers, key);
  } catch {
    throw new ProjectionEvidenceError(encrypted ? "decryption_failed" : "invalid_evidence");
  }
  if (isExpiredStub(hydrated)) throw new ProjectionEvidenceError("evidence_expired");
  if (hydrated instanceof Uint8Array) throw new ProjectionEvidenceError("invalid_evidence");
  return hydrated;
}
