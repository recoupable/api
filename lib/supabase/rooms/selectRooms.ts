import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

type Room = Tables<"rooms">;

export interface SelectRoomsParams {
  /** Account IDs to filter by. If undefined, returns all records. */
  account_ids?: string[];
  /** Filter by artist ID */
  artist_id?: string;
  /** Zero-based inclusive row range for a single page (PostgREST `.range`).
   *  When set, also adds `id` as a stable secondary sort so paginated reads
   *  don't skip/duplicate rows at page boundaries. */
  range?: { from: number; to: number };
}

/**
 * Selects rooms with optional filters.
 * - If account_ids is provided, filters by those IDs.
 * - If account_ids is undefined, returns all records.
 *
 * @param params - Optional filter parameters
 * @param params.account_ids - Optional array of account IDs to filter by.
 * @param params.artist_id - Filter by artist ID
 * @returns Array of rooms or null if error
 */
export async function selectRooms(params: SelectRoomsParams = {}): Promise<Room[] | null> {
  const { account_ids, artist_id, range } = params;

  // If account_ids is an empty array, return empty (no accounts to look up)
  if (account_ids !== undefined && account_ids.length === 0) {
    return [];
  }

  let query = supabase.from("rooms").select("*");

  // Filter by account IDs if provided
  if (account_ids !== undefined) {
    query = query.in("account_id", account_ids);
  }

  if (artist_id) {
    query = query.eq("artist_id", artist_id);
  }

  query = query.order("updated_at", { ascending: false });

  if (range) {
    query = query.order("id", { ascending: false }).range(range.from, range.to);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[ERROR] selectRooms:", error);
    return null;
  }

  return data || [];
}
