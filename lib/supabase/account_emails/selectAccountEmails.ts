import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Select account_emails by email addresses
 *
 * @param params - The parameters for the query
 * @param params.emails - Array of email addresses to query
 * @returns Array of account_emails rows
 */
export default async function selectAccountEmails({
  emails,
}: {
  emails: string[];
}): Promise<Tables<"account_emails">[]> {
  if (!Array.isArray(emails) || emails.length === 0) return [];

  const { data, error } = await supabase.from("account_emails").select("*").in("email", emails);

  if (error) {
    console.error("Error fetching account_emails by emails:", error);
    return [];
  }

  return data || [];
}
