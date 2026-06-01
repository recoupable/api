import supabase from "@/lib/supabase/serverClient";

export interface AgentSignupRow {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

/**
 * Returns API key records whose associated account email starts with "agent+".
 * Joins account_api_keys -> accounts -> account_emails and filters by the email prefix.
 *
 * @param cutoffDate - Optional ISO date string; only returns records created on or after this date
 * @returns Array of agent sign-up records ordered by created_at descending
 */
export async function getAgentSignups(cutoffDate?: string): Promise<AgentSignupRow[]> {
  let query = supabase
    .from("account_api_keys")
    .select("id, name, created_at, account, accounts!inner(account_emails!inner(email))")
    .like("accounts.account_emails.email", "agent+%")
    .order("created_at", { ascending: false });

  if (cutoffDate) {
    query = query.gte("created_at", cutoffDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching agent signups:", error);
    return [];
  }

  if (!data) return [];

  return data.map((row) => {
    const accounts = row.accounts as unknown as { account_emails: { email: string }[] };
    const email = accounts?.account_emails?.[0]?.email ?? "";
    return {
      id: row.id,
      name: row.name,
      email,
      created_at: row.created_at,
    };
  });
}
