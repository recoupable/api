import supabase from "@/lib/supabase/serverClient";
import {
  AGENT_TEMPLATE_WITH_CREATOR_SELECT,
  type AgentTemplateWithCreator,
} from "@/lib/supabase/agent_templates/agentTemplateWithCreatorSelect";

/**
 * Selects a single agent template by id, joined with the creator account
 * (id, name, image, admin-email markers).
 *
 * Returns `null` only when the row does not exist. Database errors throw so
 * callers can distinguish a real failure from a missing row.
 */
export async function selectAgentTemplateById(
  id: string,
): Promise<AgentTemplateWithCreator | null> {
  const { data, error } = await supabase
    .from("agent_templates")
    .select(AGENT_TEMPLATE_WITH_CREATOR_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Error selecting agent template by id:", error);
    throw new Error(`selectAgentTemplateById failed: ${error.message}`);
  }

  return data;
}
