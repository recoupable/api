import supabase from "@/lib/supabase/serverClient";
import {
  AGENT_TEMPLATE_WITH_CREATOR_SELECT,
  type AgentTemplateWithCreator,
} from "@/lib/supabase/agent_templates/agentTemplateWithCreatorSelect";

/**
 * Selects every agent template that has been shared with `accountId` via
 * `agent_template_shares`, joined with the creator block. Throws on database
 * error.
 *
 * The nested join is unwrapped to return `AgentTemplateWithCreator[]` rows
 * directly — postgrest types the relation as an array per its
 * `isOneToOne: false` foreign key, even though each share row points to a
 * single template.
 */
export async function selectSharedAgentTemplates(
  accountId: string,
): Promise<AgentTemplateWithCreator[]> {
  const { data, error } = await supabase
    .from("agent_template_shares")
    .select(
      `template:agent_templates!agent_template_shares_template_id_fkey (
        ${AGENT_TEMPLATE_WITH_CREATOR_SELECT}
      )`,
    )
    .eq("user_id", accountId);

  if (error) {
    console.error("Error selecting shared agent_templates:", error);
    throw new Error(`selectSharedAgentTemplates failed: ${error.message}`);
  }

  const rows: AgentTemplateWithCreator[] = [];
  (data ?? []).forEach(share => {
    const { template } = share as {
      template: AgentTemplateWithCreator | AgentTemplateWithCreator[] | null;
    };
    if (!template) return;
    if (Array.isArray(template)) rows.push(...template);
    else rows.push(template);
  });
  return rows;
}
