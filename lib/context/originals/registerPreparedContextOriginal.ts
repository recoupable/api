import { verifyContextOriginal } from "./verifyContextOriginal";
import { registerContextOriginal } from "./registerContextOriginal";
import { ContextOriginalNeedsReconciliation } from "./ContextOriginalNeedsReconciliation";
import type { prepareContextOriginal } from "./prepareContextOriginal";

/** Internal only: prove stored bytes match preparation before any registration. */
export async function registerPreparedContextOriginal(
  actor: string,
  owner: string,
  sourceId: string,
  idempotencyKey: string,
  prepared: Awaited<ReturnType<typeof prepareContextOriginal>>,
) {
  const stored = await verifyContextOriginal(actor, owner, prepared.key);
  if (
    stored.sha256 !== prepared.sha256 ||
    stored.bytes !== prepared.bytes ||
    stored.mediaType !== prepared.mediaType
  )
    throw new Error("Stored original conflicts with preparation");
  const receipt = await registerContextOriginal(
    actor,
    owner,
    { sourceId, idempotencyKey, fileKey: prepared.key },
    prepared,
  );
  if (
    receipt.fingerprint !== prepared.sha256 ||
    receipt.bytes !== prepared.bytes ||
    receipt.media_type !== prepared.mediaType
  )
    throw new ContextOriginalNeedsReconciliation(
      owner,
      sourceId,
      idempotencyKey,
      new Error("Original changed during registration"),
    );
  return receipt;
}
