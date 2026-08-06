import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/** Only what an avatar needs — `account_info` also carries knowledge blobs and instructions. */
export type AccountInfoAvatar = Pick<Tables<"account_info">, "account_id" | "image">;

/**
 * Retrieves `account_info` rows for several accounts at once — the plural
 * sibling of `selectAccountInfo`, which reads one account and is the wrong
 * shape for a list response that would otherwise issue a query per row.
 *
 * Projects `account_id` and `image` only: `account_info` also holds knowledge
 * entries and AI instructions, which a list of avatars has no use for and would
 * pay for in payload and deserialization.
 *
 * @param accountIds - The account IDs to read info for
 * @returns The matching rows, or [] when none were asked for or the query fails
 */
export async function selectAccountInfos(accountIds: string[]): Promise<AccountInfoAvatar[]> {
  if (!accountIds.length) return [];

  const { data, error } = await supabase
    .from("account_info")
    .select("account_id, image")
    .in("account_id", accountIds);

  if (error) {
    console.error("Error fetching account_info:", error);
    return [];
  }

  return data ?? [];
}
