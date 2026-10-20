import { z } from "zod";
import { contextOriginalPreparationSchema } from "./contextOriginalPreparationSchema";
import { prepareContextOriginal } from "./prepareContextOriginal";
import { registerPreparedContextOriginal } from "./registerPreparedContextOriginal";
import { ContextOriginalNeedsReconciliation } from "./ContextOriginalNeedsReconciliation";

/** Explicit recovery only: verify stable existing object, never upload or delete. */
export async function reconcileContextOriginal(
  actor: string,
  owner: string,
  input: unknown,
  stream: ReadableStream<Uint8Array>,
) {
  actor = z.string().uuid().parse(actor).toLowerCase();
  owner = z.string().uuid().parse(owner).toLowerCase();
  const parsed = contextOriginalPreparationSchema.parse(input);
  const prepared = await prepareContextOriginal(actor, owner, parsed, stream);
  try {
    return await registerPreparedContextOriginal(
      actor,
      owner,
      parsed.sourceId,
      parsed.idempotencyKey,
      prepared,
    );
  } catch (cause) {
    if (cause instanceof ContextOriginalNeedsReconciliation) throw cause;
    throw new ContextOriginalNeedsReconciliation(
      owner,
      parsed.sourceId,
      parsed.idempotencyKey,
      cause,
    );
  }
}
