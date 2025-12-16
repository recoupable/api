import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Select account_emails by email addresses and/or account IDs
 *
 * @param params - The parameters for the query
 * @param params.emails - Optional array of email addresses to query
 * @param params.accountIds - Optional array of account IDs to query
 * @returns Array of account_emails rows
 */
export default async function selectAccountEmails({
  emails,
  accountIds,
}: {
  emails?: string[];
  accountIds?: string | string[];
}): Promise<Tables<"account_emails">[]> {
  let query = supabase.from("account_emails").select("*");

  // Build query based on provided parameters
  const ids = accountIds ? (Array.isArray(accountIds) ? accountIds : [accountIds]) : [];
  const hasEmails = Array.isArray(emails) && emails.length > 0;
  const hasAccountIds = ids.length > 0;

  // If neither parameter is provided, return empty array
  if (!hasEmails && !hasAccountIds) {
    return [];
  }

  // Apply filters
  if (hasEmails) {
    query = query.in("email", emails);
  }

  if (hasAccountIds) {
    query = query.in("account_id", ids);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching account_emails:", error);
    return [];
  }

  return data || [];
}
