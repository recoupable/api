import supabase from "@/lib/supabase/serverClient";
import { isAgentPrefixEmail } from "@/lib/agents/isAgentPrefixEmail";

export interface AgentSignupRow {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

/**
 * Reads API-key metadata for accounts with an agent-prefixed email, without key hashes.
 *
 * @param cutoffDate - Inclusive API-key creation cutoff, or undefined for no date filter.
 * @returns Returned key records, not unique agents or proof of signup origin.
 */
export async function getAgentSignups(cutoffDate?: string): Promise<AgentSignupRow[]> {
  let query = supabase
    .from("account_api_keys")
    .select("id,name,created_at,accounts!inner(account_emails!inner(email))")
    .ilike("accounts.account_emails.email", "agent+%")
    .order("created_at", { ascending: false });

  if (cutoffDate) query = query.gte("created_at", cutoffDate);

  const { data, error } = await query;
  if (error) throw new Error("Failed to retrieve agent signup metadata");

  return (data ?? []).flatMap(row => {
    const email = row.accounts.account_emails.find(
      item => item.email && isAgentPrefixEmail(item.email),
    )?.email;
    if (!email) return [];
    return [{ id: row.id, name: row.name, email, created_at: row.created_at }];
  });
}
