import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Retrieves `account_info` rows for several accounts at once — the plural
 * sibling of `selectAccountInfo`, which reads one account and is the wrong
 * shape for a list response that would otherwise issue a query per row.
 *
 * @param accountIds - The account IDs to read info for
 * @returns The matching rows, or [] when none were asked for or the query fails
 */
export async function selectAccountInfos(accountIds: string[]): Promise<Tables<"account_info">[]> {
  if (!accountIds.length) return [];

  const { data, error } = await supabase
    .from("account_info")
    .select("*")
    .in("account_id", accountIds);

  if (error) {
    console.error("Error fetching account_info:", error);
    return [];
  }

  return data ?? [];
}
