import supabase from "@/lib/supabase/serverClient";
import { getSocialPlatformByLink } from "@/lib/artists/getSocialPlatformByLink";

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
  const { data, error } = await supabase
    .from("agent_status")
    .select("*, agent:agents(*)")
    .in("social_id", artistSocialIds);

  if (error) {
    console.error("Error fetching artist agents:", error);
    return [];
  }

  if (!data) return [];

  const agentIds = [...new Set(data.map(ele => ele.agent.id))];

  const { data: agents } = await supabase
    .from("agents")
    .select("*, agent_status(*, social:socials(*))")
    .in("id", agentIds);

  if (!agents) return [];

  const transformedAgents = agents.map(agent => ({
    type: new String(
      agent.agent_status.length > 1
        ? "wrapped"
        : getSocialPlatformByLink(agent.agent_status[0].social.profile_url),
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
