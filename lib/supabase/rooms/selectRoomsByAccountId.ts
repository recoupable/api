import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

type Room = Tables<"rooms">;

interface SelectRoomsByAccountIdParams {
  accountId: string;
  artistId?: string;
}

/**
 * Selects rooms for a given account, optionally filtered by artist.
 *
 * @param params - Parameters for the query
 * @param params.accountId - The account ID to filter rooms by
 * @param params.artistId - Optional artist ID to further filter rooms
 * @returns Array of rooms or null if error
 */
export async function selectRoomsByAccountId({
  accountId,
  artistId,
}: SelectRoomsByAccountIdParams): Promise<Room[] | null> {
  let query = supabase
    .from("rooms")
    .select("*")
    .eq("account_id", accountId)
    .order("updated_at", { ascending: false });

  if (artistId) {
    query = query.eq("artist_id", artistId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[ERROR] selectRoomsByAccountId:", error);
    return null;
  }

  return data || [];
}
