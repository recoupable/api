import { cancelContextRequest } from "@/lib/supabase/context_requests/cancelContextRequest";

/** Stops a saved request in the selected workspace. It never dispatches, refunds or withdraws accepted evidence. */
export async function processCancelContextRequest(
  accountId: string,
  ownerId: string,
  requestId: string,
) {
  const receipt = await cancelContextRequest(ownerId, accountId, requestId);
  // Postgres returns UUIDs in lowercase; a caller may have spelled the workspace in uppercase.
  if (receipt.request.owner_id.toLowerCase() !== ownerId.toLowerCase())
    throw new Error("Context request not found");
  return receipt;
}
