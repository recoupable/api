import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

type Room = Tables<"rooms">;

export interface SelectRoomsParams {
  /** Account IDs to filter by. If undefined, returns all records. */
  account_ids?: string[];
  /** Organization ID to filter by membership. Uses inner join with account_organization_ids. */
  org_id?: string;
  /** Filter by artist ID */
  artist_id?: string;
}

/**
 * Selects rooms with optional filters.
 * - If account_ids is provided, filters by those IDs.
 * - If org_id is provided, filters by organization membership (inner join).
 * - If neither is provided, returns all records.
 *
 * @param params - Optional filter parameters
 * @param params.account_ids - Optional array of account IDs to filter by.
 * @param params.org_id - Optional organization ID to filter by membership.
 * @param params.artist_id - Filter by artist ID
 * @returns Array of rooms or null if error
 */
export async function selectRooms(params: SelectRoomsParams = {}): Promise<Room[] | null> {
  const { account_ids, org_id, artist_id } = params;

  // If account_ids is an empty array, return empty (no accounts to look up)
  if (account_ids !== undefined && account_ids.length === 0) {
    return [];
  }

  // Use different select based on whether we need org join
  // Join path: rooms -> accounts -> account_organization_ids
  // Must specify FK name because accounts has two relationships to account_organization_ids
  const selectColumns = org_id
    ? "*, accounts!inner(account_organization_ids!account_organization_ids_account_id_fkey!inner(organization_id))"
    : "*";

  let query = supabase.from("rooms").select(selectColumns);

  // Filter by org membership if org_id provided
  if (org_id) {
    query = query.eq("accounts.account_organization_ids.organization_id", org_id);
  }

  // Filter by account IDs if provided
  if (account_ids !== undefined) {
    query = query.in("account_id", account_ids);
  }

  if (artist_id) {
    query = query.eq("artist_id", artist_id);
  }

  query = query.order("updated_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error("[ERROR] selectRooms:", error);
    return null;
  }

  if (!data) {
    return [];
  }

  // Strip joined data if present (from org join through accounts)
  if (org_id) {
    return (data as unknown as (Room & { accounts?: unknown })[]).map(
      ({ accounts: _, ...room }) => room,
    );
  }

  return data as unknown as Room[];
}
