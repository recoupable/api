import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

// DRY: Use database types instead of custom interfaces
export type Agent = Tables<"agents">;
export type Social = Tables<"socials">;

export type AgentStatusWithSocial = Tables<"agent_status"> & {
  social: Social | null;
};

export type AgentWithStatusAndSocials = Agent & {
  agent_status: AgentStatusWithSocial[];
};

/**
 * Select agents by IDs with joined agent_status and socials data
 *
 * @param params - The parameters for the query
 * @param params.agentIds - Array of agent IDs to filter by
 * @returns Array of agent records with joined agent_status and socials data
 */
export default async function selectAgentsWithStatusAndSocials({
  agentIds,
}: {
  agentIds?: string[];
}): Promise<AgentWithStatusAndSocials[]> {
  const hasAgentIds = Array.isArray(agentIds) && agentIds.length > 0;

  // If no agentIds provided, return empty array
  if (!hasAgentIds) {
    return [];
  }

  // DRY: Use select('*') with nested join syntax
  const { data, error } = await supabase
    .from("agents")
    .select("*, agent_status(*, social:socials(*))")
    .in("id", agentIds);

  if (error) {
    throw error;
  }

  return data || [];
}
