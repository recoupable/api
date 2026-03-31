import { Tables } from "@/types/database.types";
import supabase from "../serverClient";

/**
 * Selects the memories table in Supabase
 *
 * @param roomId - The room ID to query memories for
 * @param options - Options for the query (ascending order and limit)
 * @param options.ascending - Whether to order the results by ascending order
 * @param options.limit - The limit of the results
 * @returns Supabase query result with memories data
 */
export default async function selectMemories(
  roomId: string,
  options?: {
    ascending?: boolean;
    limit?: number;
  },
): Promise<Tables<"memories">[] | null> {
  const ascending = options?.ascending ?? false;
  const limit = options?.limit;

  let query = supabase
    .from("memories")
    .select("*")
    .eq("room_id", roomId)
    .order("updated_at", { ascending });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error selecting memories:", error);
    return null;
  }

  return data;
}
