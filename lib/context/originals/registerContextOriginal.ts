import { z } from "zod";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { verifyContextOriginal } from "./verifyContextOriginal";
import { contextOriginalReceiptSchema } from "./contextOriginalReceiptSchema";
import { ContextOriginalNeedsReconciliation } from "./ContextOriginalNeedsReconciliation";

const inputSchema = z
  .object({
    sourceId: z.string().uuid(),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/),
    fileKey: z.string().min(1),
  })
  .strict();

/** Unused server adapter: verify private bytes before retaining their scoped version receipt. */
export async function registerContextOriginal(actor: string, owner: string, input: unknown) {
  const parsed = inputSchema.parse(input);
  const verified = await verifyContextOriginal(actor, owner, parsed.fileKey);
  try {
    const raw = await callContextRpc("register_context_original", {
      p_actor: actor,
      p_owner: owner,
      p_source: parsed.sourceId,
      p_key: parsed.idempotencyKey,
      p_storage_path: verified.key,
      p_sha256: verified.sha256,
      p_bytes: verified.bytes,
      p_media_type: verified.mediaType,
    });
    const receipt = contextOriginalReceiptSchema.parse(raw);
    if (
      receipt.owner_id !== owner ||
      receipt.source_id !== parsed.sourceId ||
      receipt.fingerprint !== verified.sha256 ||
      receipt.bytes !== verified.bytes ||
      receipt.media_type !== verified.mediaType
    )
      throw new Error("Original receipt does not match verified bytes and scope");
    return receipt;
  } catch (cause) {
    // Dispatch may already have committed. Never report a confirmed failed save or retry here.
    throw new ContextOriginalNeedsReconciliation(
      owner,
      parsed.sourceId,
      parsed.idempotencyKey,
      cause,
    );
  }
}
