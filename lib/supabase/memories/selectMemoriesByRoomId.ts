import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

const PAGE_SIZE = 1000;

/**
 * All memories for a room, oldest-first with `id` as a stable secondary
 * sort, paginated past the PostgREST 1,000-row cap. Unlike `selectMemories`
 * (single page), this returns every memory — required by the Phase 2
 * backfill so rooms with >1,000 messages aren't truncated.
 */
export async function selectMemoriesByRoomId(roomId: string): Promise<Tables<"memories">[]> {
  const memories: Tables<"memories">[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("memories")
      .select("*")
      .eq("room_id", roomId)
      .order("updated_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    memories.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }

  return memories;
}
