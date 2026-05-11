import type { QueryData } from "@supabase/supabase-js";
import supabase from "@/lib/supabase/serverClient";

const SELECT = `
  *,
  creator:accounts!agent_templates_creator_fkey (
    id,
    name,
    account_info ( image ),
    account_emails ( email )
  )
` as const;

const _typedQuery = supabase.from("agent_templates").select(SELECT);

export type AgentTemplateWithCreator = QueryData<typeof _typedQuery>[number];

type SelectAgentTemplatesParams = { id: string } | { accessibleTo: string };

/**
 * Single entry point for reading agent_templates joined with the creator
 * block (id, name, image, admin-email markers).
 *
 *  - `{ id }` returns the row with that id, or empty when not found.
 *  - `{ accessibleTo }` returns every row the account can see: ones they
 *    own, public ones, and ones shared with them via agent_template_shares
 *    — deduped.
 *
 * Throws on database error so callers can distinguish a real failure from
 * an empty result.
 */
export async function selectAgentTemplates(
  params: SelectAgentTemplatesParams,
): Promise<AgentTemplateWithCreator[]> {
  if ("id" in params) {
    const { data, error } = await supabase
      .from("agent_templates")
      .select(SELECT)
      .eq("id", params.id);
    if (error) {
      console.error("Error selecting agent_template by id:", error);
      throw new Error(`selectAgentTemplates(id) failed: ${error.message}`);
    }
    return data ?? [];
  }

  const accountId = params.accessibleTo;
  const [ownedAndPublic, shared] = await Promise.all([
    supabase
      .from("agent_templates")
      .select(SELECT)
      .or(`creator.eq.${accountId},is_private.eq.false`)
      .order("title"),
    supabase
      .from("agent_template_shares")
      .select(`template:agent_templates!agent_template_shares_template_id_fkey (${SELECT})`)
      .eq("user_id", accountId),
  ]);

  if (ownedAndPublic.error) {
    console.error("Error selecting owned/public agent_templates:", ownedAndPublic.error);
    throw new Error(
      `selectAgentTemplates(accessibleTo) owned/public failed: ${ownedAndPublic.error.message}`,
    );
  }
  if (shared.error) {
    console.error("Error selecting shared agent_templates:", shared.error);
    throw new Error(`selectAgentTemplates(accessibleTo) shared failed: ${shared.error.message}`);
  }

  const byId = new Map<string, AgentTemplateWithCreator>();
  (ownedAndPublic.data ?? []).forEach(row => byId.set(row.id, row));
  (shared.data ?? []).forEach(share => {
    const { template } = share as {
      template: AgentTemplateWithCreator | AgentTemplateWithCreator[] | null;
    };
    if (!template) return;
    const list = Array.isArray(template) ? template : [template];
    list.forEach(t => {
      if (t && !byId.has(t.id)) byId.set(t.id, t);
    });
  });
  return Array.from(byId.values());
}
