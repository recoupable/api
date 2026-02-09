import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Deletes the snapshot record for an account and returns the deleted row.
 *
 * @param accountId - The account ID whose snapshot should be deleted
 * @returns The deleted snapshot record, or null if not found or on error
 */
export async function deleteAccountSnapshot(
  accountId: string,
): Promise<Tables<"account_snapshots"> | null> {
  const { data, error } = await supabase
    .from("account_snapshots")
    .delete()
    .eq("account_id", accountId)
    .select("*")
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}
