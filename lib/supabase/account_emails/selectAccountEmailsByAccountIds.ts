import supabase from "@/lib/supabase/serverClient";

/**
 * Select account_emails rows for the given set of account_ids. Short-circuits
 * to an empty array when `account_ids` is empty; Supabase's `.in(..., [])`
 * behavior is undefined and returns 400 on some paths.
 */
export async function selectAccountEmailsByAccountIds(accountIds: string[]) {
  if (accountIds.length === 0) return [];

  const { data, error } = await supabase
    .from("account_emails")
    .select("*")
    .in("account_id", accountIds);

  if (error) {
    console.error("Error fetching account_emails by account_ids:", error);
    return [];
  }

  return data ?? [];
}
