import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Selects snapshots for an account, ordered by creation date (newest first).
 *
 * @param accountId - The account ID to get snapshots for
 * @returns Array of snapshot records, or empty array if none found
 */
export async function selectAccountSnapshots(
  accountId: string,
): Promise<Tables<"account_snapshots">[]> {
  const { data, error } = await supabase
    .from("account_snapshots")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });

  if (error) {
    // Table might not exist or query failed - return empty array
    return [];
  }

  return data ?? [];
}
