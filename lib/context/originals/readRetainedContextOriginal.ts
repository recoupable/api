import { z } from "zod";
import { authorizeContextOwner } from "../authorizeContextOwner";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { getContextOriginalFile } from "@/lib/supabase/storage/getContextOriginalFile";
import { contextOriginalReceiptSchema } from "./contextOriginalReceiptSchema";
import { readContextOriginalRegistration } from "./readContextOriginalRegistration";
import { verifyContextOriginal } from "./verifyContextOriginal";

const internalSchema = contextOriginalReceiptSchema.extend({
  bucket: z.literal("context-private"),
  storage_path: z.string().min(1),
});

/** Unused server-only readback. Never serialize the internal path tuple in HTTP/MCP. */
export async function readRetainedContextOriginal(actor: string, owner: string, id: string) {
  actor = z.string().uuid().parse(actor).toLowerCase();
  owner = z.string().uuid().parse(owner).toLowerCase();
  id = z.string().uuid().parse(id).toLowerCase();
  await authorizeContextOwner(actor, owner === actor ? undefined : owner);
  const internal = internalSchema.parse(
    await callContextRpc("get_context_original_retrieval", {
      p_actor: actor,
      p_owner: owner,
      p_receipt: id,
    }),
  );
  if (internal.owner_id !== owner || internal.id !== id) throw new Error("Original unavailable");
  let file: Blob | undefined;
  const verified = await verifyContextOriginal(actor, owner, internal.storage_path, async key => {
    file = await getContextOriginalFile(key);
    return file;
  });
  if (
    !file ||
    verified.sha256 !== internal.fingerprint ||
    verified.bytes !== internal.bytes ||
    verified.mediaType !== internal.media_type
  )
    throw new Error("Original unavailable");
  const receipt = await readContextOriginalRegistration(actor, owner, id);
  const { bucket: _bucket, storage_path: _path, ...expected } = internal;
  if (JSON.stringify(receipt) !== JSON.stringify(expected)) throw new Error("Original unavailable");
  return { receipt, file };
}
