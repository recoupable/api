import supabase from "@/lib/supabase/serverClient";
import {
  AGENT_TEMPLATE_WITH_CREATOR_SELECT,
  type AgentTemplateWithCreator,
} from "@/lib/supabase/agent_templates/agentTemplateWithCreatorSelect";

/**
 * Selects every agent template the account owns or that is public,
 * joined with the creator block. Throws on database error.
 *
 * TODO: paginate. Subject to Supabase's default 1000-row cap; as public
 * templates grow this will silently truncate.
 */
export async function selectOwnedAndPublicAgentTemplates(
  accountId: string,
): Promise<AgentTemplateWithCreator[]> {
  const { data, error } = await supabase
    .from("agent_templates")
    .select(AGENT_TEMPLATE_WITH_CREATOR_SELECT)
    .or(`creator.eq.${accountId},is_private.eq.false`)
    .order("title");

  if (error) {
    console.error("Error selecting owned/public agent_templates:", error);
    throw new Error(`selectOwnedAndPublicAgentTemplates failed: ${error.message}`);
  }

  return data ?? [];
}
