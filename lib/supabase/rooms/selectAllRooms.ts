import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

const PAGE_SIZE = 1000;

/**
 * All rooms, oldest-first with `id` as a stable secondary sort, paginated
 * past the PostgREST 1,000-row cap. Used by the Phase 2 rooms→sessions
 * backfill (`scripts/backfillRoomsToSessions.ts`).
 */
export async function selectAllRooms(): Promise<Tables<"rooms">[]> {
  const rooms: Tables<"rooms">[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .order("updated_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    rooms.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }

  return rooms;
}
