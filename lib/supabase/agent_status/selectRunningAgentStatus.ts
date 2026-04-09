import supabase from "@/lib/supabase/serverClient";
import { TERMINAL_AGENT_STATUSES } from "@/types/AgentStatus";

/**
 * Select the most recently updated non-terminal agent status for the given social IDs.
 *
 * @param socialIds - Array of social IDs to search for running agents
 * @returns The most recent running agent status with social and agent joins, or null
 */
export async function selectRunningAgentStatus(socialIds: string[]) {
  if (socialIds.length === 0) {
    return null;
  }

  let query = supabase
    .from("agent_status")
    .select("*, social:socials(*), agent:agents(*)")
    .in("social_id", socialIds);

  // Exclude all terminal statuses
  for (const status of TERMINAL_AGENT_STATUSES) {
    query = query.neq("status", status);
  }

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}
