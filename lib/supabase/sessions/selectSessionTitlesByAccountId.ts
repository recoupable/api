import supabase from "@/lib/supabase/serverClient";

/**
 * Returns the titles of every session belonging to the given account.
 * Used by `resolveSessionTitle` to avoid collisions when generating
 * fallback session titles.
 *
 * @param accountId - The account whose session titles to fetch.
 * @returns The list of titles, or an empty array if the query failed.
 */
export async function selectSessionTitlesByAccountId(accountId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("title")
    .eq("account_id", accountId);

  if (error || !data) {
    if (error) console.error("Error fetching session titles:", error);
    return [];
  }

  return data.map(row => row.title);
}
