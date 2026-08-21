import supabase from "../serverClient";
import { Tables } from "@/types/database.types";

export type SelectMusicGenerationsParams = {
  id?: string;
  accountId?: string;
  organizationId?: string | null;
  status?: string;
  limit?: number;
  offset?: number;
};

/**
 * Read music generation rows, newest first.
 *
 * @param params - Optional filters. `organizationId: null` narrows to personal
 *   generations, while omitting the key leaves organization scope untouched.
 * @returns Matching rows, newest first.
 */
export async function selectMusicGenerations(
  params: SelectMusicGenerationsParams = {},
): Promise<Tables<"music_generations">[]> {
  let query = supabase
    .from("music_generations")
    .select("*")
    // Secondary sort on id keeps a limited read stable when two generations
    // share a created_at, the same reason selectPlaycountSnapshots does it.
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (params.id) query = query.eq("id", params.id);
  if (params.accountId) query = query.eq("account_id", params.accountId);
  if (params.organizationId === null) query = query.is("organization_id", null);
  else if (params.organizationId) query = query.eq("organization_id", params.organizationId);
  if (params.status) query = query.eq("status", params.status);
  if (params.limit) {
    const offset = params.offset ?? 0;
    query = query.range(offset, offset + params.limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch music_generations: ${error.message}`);
  }

  return data || [];
}
