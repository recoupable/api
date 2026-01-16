import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

// DRY: Use database types instead of custom interfaces
export type AgentStatus = Tables<"agent_status">;

export type AgentStatusWithAgent = AgentStatus & {
  agent: Tables<"agents"> | null;
};

/**
 * Select agent_status records by social IDs with joined agent data
 *
 * @param params - The parameters for the query
 * @param params.socialIds - Array of social IDs to filter by
 * @returns Array of agent_status records with joined agent data
 */
export default async function selectAgentStatusBySocialIds({
  socialIds,
}: {
  socialIds?: string[];
}): Promise<AgentStatusWithAgent[]> {
  const hasSocialIds = Array.isArray(socialIds) && socialIds.length > 0;

  // If no socialIds provided, return empty array
  if (!hasSocialIds) {
    return [];
  }

  // DRY: Use select('*') with join syntax
  const { data, error } = await supabase
    .from("agent_status")
    .select("*, agent:agents(*)")
    .in("social_id", socialIds);

  if (error) {
    throw error;
  }

  return data || [];
}
