import supabase from "@/lib/supabase/serverClient";

export interface AgentTemplateShare {
  template_id: string;
  user_id: string;
  created_at: string;
}

/**
 * Select agent template shares by template IDs
 *
 * @param params - The parameters for the query
 * @param params.templateIds - Optional array of template IDs to get shares for
 * @returns Array of share records
 */
export default async function selectAgentTemplateShares({
  templateIds,
}: {
  templateIds?: string[];
}): Promise<AgentTemplateShare[]> {
  if (!Array.isArray(templateIds) || templateIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("agent_template_shares")
    .select("template_id, user_id, created_at")
    .in("template_id", templateIds);

  if (error) {
    throw error;
  }

  return (data as AgentTemplateShare[]) || [];
}
