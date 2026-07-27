import supabase from "../serverClient";

/**
 * Of the given accounts, which have at least one rostered artist.
 *
 * The sibling `selectAccountArtistIds` returns only `artist_id`, so it can't
 * answer "which of these accounts is activated" — the cold-start nudge sweep
 * needs the account side of the link (chat#1889).
 *
 * @param accountIds - Accounts to check.
 * @returns The subset that has at least one artist (deduplicated).
 */
export async function selectRosteredAccountIds(
  accountIds: string[],
): Promise<string[]> {
  if (accountIds.length === 0) return [];

  const { data, error } = await supabase
    .from("account_artist_ids")
    .select("account_id")
    .in("account_id", accountIds);

  if (error) {
    console.error("Error fetching rostered account ids:", error);
    // Fail closed: an errored read must not make every account look cold-start
    // and trigger a mass nudge.
    return accountIds;
  }

  return [...new Set((data ?? []).map((row) => row.account_id))];
}
