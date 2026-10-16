import supabase from "../serverClient";
import { Tables } from "@/types/database.types";

export type SelectScheduledPostsParams = {
  id?: string;
  accountId?: string;
  status?: string;
  platform?: string;
  limit?: number;
  offset?: number;
};

/**
 * Read scheduled post rows, newest first.
 *
 * @param params - Optional filters.
 * @returns Matching rows, newest first.
 */
export async function selectScheduledPosts(
  params: SelectScheduledPostsParams = {},
): Promise<Tables<"scheduled_posts">[]> {
  let query = supabase
    .from("scheduled_posts")
    .select("*")
    // Secondary sort on id keeps a limited read stable when two posts share a
    // created_at, as in selectMusicGenerations.
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (params.id) query = query.eq("id", params.id);
  if (params.accountId) query = query.eq("account_id", params.accountId);
  if (params.status) query = query.eq("status", params.status);
  if (params.platform) query = query.eq("platform", params.platform);
  if (params.limit) {
    const offset = params.offset ?? 0;
    query = query.range(offset, offset + params.limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch scheduled_posts: ${error.message}`);
  }

  return data || [];
}
