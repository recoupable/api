import { z } from "zod";
import { authorizeContextOwner } from "../authorizeContextOwner";
import { insertContextOriginalFile } from "@/lib/supabase/storage/insertContextOriginalFile";
import { contextOriginalPreparationSchema } from "./contextOriginalPreparationSchema";
import { prepareContextOriginal } from "./prepareContextOriginal";
import { registerPreparedContextOriginal } from "./registerPreparedContextOriginal";
import { ContextOriginalNeedsReconciliation } from "./ContextOriginalNeedsReconciliation";

/** Unconnected server flow: no-overwrite storage, byte readback, retained receipt. */
export async function storeContextOriginal(
  actor: string,
  owner: string,
  input: unknown,
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
) {
  actor = z.string().uuid().parse(actor).toLowerCase();
  owner = z.string().uuid().parse(owner).toLowerCase();
  const parsed = contextOriginalPreparationSchema.parse(input);
  const prepared = await prepareContextOriginal(actor, owner, parsed, stream);
  await authorizeContextOwner(actor, owner === actor ? undefined : owner);
  if (signal?.aborted) throw new Error("Original request disconnected");
  try {
    await insertContextOriginalFile(prepared.key, prepared.file, prepared.mediaType);
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
