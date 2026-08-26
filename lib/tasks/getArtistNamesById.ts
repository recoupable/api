import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";

/**
 * Display names for a set of artist account ids, in one batched select
 * (chat#2006 item 6). Best-effort: a failed lookup logs and yields an empty
 * map so the task list still loads, with `artist_name: null`, the same way
 * `owner_email` degrades.
 *
 * @param artistAccountIds - Artist account ids (duplicates fine)
 * @returns Map of account id → display name (null when the account has none)
 */
export async function getArtistNamesById(
  artistAccountIds: string[],
): Promise<Map<string, string | null>> {
  const ids = [...new Set(artistAccountIds)];
  if (ids.length === 0) return new Map();
  try {
    const accounts = await selectAccounts(ids);
    return new Map(accounts.map(account => [account.id, account.name] as const));
  } catch (error) {
    console.error("Error fetching artist accounts:", error);
    return new Map();
  }
}
