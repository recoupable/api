import { z } from "zod";
import { callContextRpc } from "./callContextRpc";

const receiptSchema = z
  .strictObject({
    outcome: z.enum(["cancelled", "already_cancelled", "not_cancellable"]),
    request: z.looseObject({
      id: z.uuid(),
      owner_id: z.uuid(),
      status: z.enum(["queued", "running", "partial", "completed", "failed", "cancelled"]),
    }),
  })
  .refine(receipt => !("claim_token" in receipt.request), "Worker claim must not leave storage")
  .refine(
    receipt =>
      receipt.outcome === "not_cancellable"
        ? ["completed", "partial"].includes(receipt.request.status)
        : receipt.request.status === "cancelled",
    "Cancellation outcome does not match the saved status",
  );

/** Service-only; the caller must authorize the actor's selected workspace. Membership is rechecked in storage. */
export async function cancelContextRequest(owner: string, actor: string, requestId: string) {
  z.uuid().parse(owner);
  z.uuid().parse(actor);
  z.uuid().parse(requestId);
  return receiptSchema.parse(
    await callContextRpc("cancel_context_request", {
      p_owner: owner,
      p_actor: actor,
      p_request: requestId,
    }),
  );
}
