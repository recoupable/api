import { selectRooms } from "@/lib/supabase/rooms/selectRooms";
import type { Tables } from "@/types/database.types";
import { paginate } from "./paginate";

/**
 * Every room, read past the PostgREST 1,000-row cap. The for-loop lives here
 * (outside `lib/supabase`); `selectRooms` stays a thin single-query helper —
 * `paginate` just calls it one page at a time.
 */
export async function selectAllRooms(): Promise<Tables<"rooms">[]> {
  return paginate((from, to) => selectRooms({ range: { from, to } }).then(rows => rows ?? []));
}
