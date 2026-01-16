import { getSocialPlatformByLink } from "@/lib/artists/getSocialPlatformByLink";
import selectAgentStatusBySocialIds from "@/lib/supabase/agent_status/selectAgentStatusBySocialIds";
import selectAgentsWithStatusAndSocials from "@/lib/supabase/agents/selectAgentsWithStatusAndSocials";

export interface ArtistAgent {
  type: string;
  agentId: string;
  updated_at: string;
}

/**
 * Fetches artist agents by their social IDs.
 *
 * Queries the agent_status and agents tables to find agents associated with
 * the given social IDs, then transforms them into a format suitable for the client.
 *
 * @param artistSocialIds - Array of social IDs to look up
 * @returns Array of ArtistAgent objects, aggregated by type
 */
export async function getArtistAgents(artistSocialIds: string[]): Promise<ArtistAgent[]> {
  let agentStatusData;
  try {
    agentStatusData = await selectAgentStatusBySocialIds({ socialIds: artistSocialIds });
  } catch {
    return [];
  }

  if (!agentStatusData.length) return [];

  const agentIds = [...new Set(agentStatusData.map(ele => ele.agent?.id).filter(Boolean))] as string[];

  let agents;
  try {
    agents = await selectAgentsWithStatusAndSocials({ agentIds });
  } catch {
    return [];
  }

  if (!agents.length) return [];

  const transformedAgents = agents.map(agent => ({
    type: new String(
      agent.agent_status.length > 1
        ? "wrapped"
        : getSocialPlatformByLink(agent.agent_status[0].social?.profile_url ?? ""),
    ).toLowerCase(),
    agentId: agent.id,
    updated_at: agent.updated_at,
  }));

  // Aggregate agents by type (latest one for each type wins)
  const aggregatedAgents: Record<string, ArtistAgent> = {};

  transformedAgents.forEach(agent => {
    const type = agent.type.toLowerCase();
    aggregatedAgents[type] = agent;
  });

  return Object.values(aggregatedAgents);
}
