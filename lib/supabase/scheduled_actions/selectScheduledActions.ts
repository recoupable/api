import { Tables } from "@/types/database.types";
import supabase from "../serverClient";

/**
 * Selects scheduled actions (tasks) from the database
 *
 * @param params - The parameters for the query
 * @returns The scheduled actions
 */
export async function selectScheduledActions(
  params: Partial<Tables<"scheduled_actions">>,
): Promise<Tables<"scheduled_actions">[]> {
  let query = supabase
    .from("scheduled_actions")
    .select("*")
    .order("created_at", { ascending: false });

  if (params.id) {
    query = query.eq("id", params.id);
  }

  if (params.account_id) {
    query = query.eq("account_id", params.account_id);
  }

  if (params.artist_account_id) {
    query = query.eq("artist_account_id", params.artist_account_id);
  }

  if (params.enabled !== undefined) {
    query = query.eq("enabled", params.enabled);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch scheduled actions: ${error.message}`);
  }

  return data || [];
}
