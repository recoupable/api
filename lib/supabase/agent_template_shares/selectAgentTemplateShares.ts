import supabase from "@/lib/supabase/serverClient";

export interface AgentTemplateShare {
  template_id: string;
  user_id: string;
  created_at: string;
}

export interface AgentTemplateShareWithTemplate extends AgentTemplateShare {
  templates: {
    id: string;
    title: string;
    description: string;
    prompt: string;
    tags: string[] | null;
    creator: string | null;
    is_private: boolean;
    created_at: string | null;
    favorites_count: number | null;
    updated_at: string | null;
  } | null;
}

const BASE_SELECT = "template_id, user_id, created_at";
const TEMPLATE_JOIN_SELECT = `
  template_id, user_id, created_at,
  templates:agent_templates(
    id, title, description, prompt, tags, creator, is_private, created_at, favorites_count, updated_at
  )
`;

/**
 * Select agent template shares by template IDs and/or user ID
 *
 * @param params - The parameters for the query
 * @param params.templateIds - Optional array of template IDs to get shares for
 * @param params.userId - Optional user ID to filter shares by
 * @param params.includeTemplates - Optional flag to include joined agent_templates data
 * @returns Array of share records
 */
export default async function selectAgentTemplateShares({
  templateIds,
  userId,
  includeTemplates = false,
}: {
  templateIds?: string[];
  userId?: string;
  includeTemplates?: boolean;
}): Promise<AgentTemplateShare[] | AgentTemplateShareWithTemplate[]> {
  const hasTemplateIds = Array.isArray(templateIds) && templateIds.length > 0;
  const hasUserId = typeof userId === "string" && userId.length > 0;

  // If neither parameter is provided, return empty array
  if (!hasTemplateIds && !hasUserId) {
    return [];
  }

  const selectFields = includeTemplates ? TEMPLATE_JOIN_SELECT : BASE_SELECT;
  let query = supabase.from("agent_template_shares").select(selectFields);

  if (hasTemplateIds) {
    query = query.in("template_id", templateIds);
  }

  if (hasUserId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
}
