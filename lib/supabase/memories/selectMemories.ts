import { Tables } from "@/types/database.types";
import supabase from "../serverClient";

/**
 * Selects the memories table in Supabase
 *
 * @param roomId - The room ID to query memories for
 * @param options - Options for the query (ascending order and limit)
 * @param options.ascending - Whether to order the results by ascending order
 * @param options.limit - The limit of the results
 * @param options.memoryId - Optional memory ID filter within the room
 * @returns Supabase query result with memories data
 */
export default async function selectMemories(
  roomId: string,
  options?: {
    ascending?: boolean;
    limit?: number;
    memoryId?: string;
    /** Zero-based inclusive row range for a single page (PostgREST `.range`).
     *  When set, also adds `id` as a stable secondary sort so paginated reads
     *  don't skip/duplicate rows at page boundaries. */
    range?: { from: number; to: number };
  },
): Promise<Tables<"memories">[] | null> {
  const ascending = options?.ascending ?? false;
  const limit = options?.limit;
  const memoryId = options?.memoryId;
  const range = options?.range;

  let query = supabase
    .from("memories")
    .select("*")
    .eq("room_id", roomId)
    .order("updated_at", { ascending });

  if (memoryId) {
    query = query.eq("id", memoryId);
  }

  if (limit) {
    query = query.limit(limit);
  }

  if (range) {
    query = query.order("id", { ascending }).range(range.from, range.to);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error selecting memories:", error);
    return null;
  }

  return data;
}
