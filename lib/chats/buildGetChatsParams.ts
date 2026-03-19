import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import type { SelectRoomsParams } from "@/lib/supabase/rooms/selectRooms";

export interface BuildGetChatsParamsInput {
  /** The authenticated account ID */
  account_id: string;
  /** Optional target account ID to filter by */
  target_account_id?: string;
  /** Optional artist ID to filter by */
  artist_id?: string;
}

export type BuildGetChatsParamsResult =
  | { params: SelectRoomsParams; error: null }
  | { params: null; error: string };

/**
 * Builds the parameters for selectRooms based on auth context.
 *
 * Returns account_ids with the key owner's account.
 * If target_account_id is provided, validates access and returns that account.
 *
 * @param input - The auth context and optional filters
 * @returns The params for selectRooms or an error
 */
export async function buildGetChatsParams(
  input: BuildGetChatsParamsInput,
): Promise<BuildGetChatsParamsResult> {
  const { account_id, target_account_id, artist_id } = input;

  // Handle account_id filter if provided
  if (target_account_id) {
    const hasAccess = await canAccessAccount({
      targetAccountId: target_account_id,
      currentAccountId: account_id,
    });
    if (!hasAccess) {
      return {
        params: null,
        error: "Access denied to specified account_id",
      };
    }
    return { params: { account_ids: [target_account_id], artist_id }, error: null };
  }

  // Return the key owner's account
  return { params: { account_ids: [account_id], artist_id }, error: null };
}
