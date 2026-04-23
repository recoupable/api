import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Select account_emails by email addresses, account IDs, and/or a domain
 * substring (ilike `%@<domain>%` — matches the legacy behavior that also hits
 * `user+tag@<domain>.anything`).
 */
export default async function selectAccountEmails({
  emails,
  accountIds,
  domain,
}: {
  emails?: string[];
  accountIds?: string | string[];
  domain?: string;
}): Promise<Tables<"account_emails">[]> {
  let query = supabase.from("account_emails").select("*");

  const ids = accountIds ? (Array.isArray(accountIds) ? accountIds : [accountIds]) : [];
  const hasEmails = Array.isArray(emails) && emails.length > 0;
  const hasAccountIds = ids.length > 0;
  const hasDomain = typeof domain === "string" && domain.length > 0;

  if (!hasEmails && !hasAccountIds && !hasDomain) {
    return [];
  }

  if (hasEmails) {
    query = query.in("email", emails);
  }

  if (hasAccountIds) {
    query = query.in("account_id", ids);
  }

  if (hasDomain) {
    query = query.ilike("email", `%@${domain}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching account_emails:", error);
    return [];
  }

  return data || [];
}
