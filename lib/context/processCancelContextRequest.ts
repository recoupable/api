import { cancelContextRequest } from "@/lib/supabase/context_requests/cancelContextRequest";

/** Stops a saved request in the selected workspace. It never dispatches, refunds or withdraws accepted evidence. */
export async function processCancelContextRequest(
  accountId: string,
  ownerId: string,
  requestId: string,
) {
  const receipt = await cancelContextRequest(ownerId, accountId, requestId);
  if (receipt.request.owner_id !== ownerId) throw new Error("Context request not found");
  return receipt;
}
