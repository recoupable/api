import { z } from "zod";
import { authorizeContextOwner } from "../authorizeContextOwner";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { contextOriginalReceiptSchema } from "./contextOriginalReceiptSchema";

/** Read retained metadata only; SQL rechecks current access and withdrawal. */
export async function readContextOriginalRegistration(actor: string, owner: string, id: string) {
  actor = z.string().uuid().parse(actor).toLowerCase();
  owner = z.string().uuid().parse(owner).toLowerCase();
  id = z.string().uuid().parse(id).toLowerCase();
  await authorizeContextOwner(actor, owner === actor ? undefined : owner);
  const raw = await callContextRpc("read_context_original_registration", {
    p_actor: actor,
    p_owner: owner,
    p_receipt: id,
  });
  const receipt = contextOriginalReceiptSchema.parse(raw);
  if (receipt.owner_id !== owner || receipt.id !== id)
    throw new Error("Original receipt does not match requested scope");
  return receipt;
}
