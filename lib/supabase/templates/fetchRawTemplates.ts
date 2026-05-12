import type { QueryData } from "@supabase/supabase-js";
import supabase from "@/lib/supabase/serverClient";

/**
 * The one SELECT for reading templates. The creator account is always
 * joined — there's no "template without creator" path in this codebase.
 */
const SELECT = `
  *,
  creator:accounts!agent_templates_creator_fkey (
    id,
    name,
    account_info ( image )
  )
` as const;

const _typedQuery = supabase.from("agent_templates").select(SELECT);

export type RawTemplate = QueryData<typeof _typedQuery>[number];

export type FetchRawTemplatesParams = { id: string } | { accessibleTo: string };

/**
 * Raw fetch of agent_templates joined with the creator account.
 *
 * `{ id }`           → returns the row with that id (or empty array).
 * `{ accessibleTo }` → returns own + public + shared rows for the account,
 *                      deduplicated by id. Caller decides ordering.
 *
 * Throws on database error.
 */
export async function fetchRawTemplates(params: FetchRawTemplatesParams): Promise<RawTemplate[]> {
  if ("id" in params) {
    const { data, error } = await supabase
      .from("agent_templates")
      .select(SELECT)
      .eq("id", params.id);
    if (error) {
      console.error("Error selecting template by id:", error);
      throw new Error(`fetchRawTemplates(id) failed: ${error.message}`);
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
    console.error("Error selecting owned/public templates:", ownedAndPublic.error);
    throw new Error(
      `fetchRawTemplates(accessibleTo) owned/public failed: ${ownedAndPublic.error.message}`,
    );
  }
  if (shared.error) {
    console.error("Error selecting shared templates:", shared.error);
    throw new Error(`fetchRawTemplates(accessibleTo) shared failed: ${shared.error.message}`);
  }

  const byId = new Map<string, RawTemplate>();
  (ownedAndPublic.data ?? []).forEach(row => byId.set(row.id, row));
  (shared.data ?? []).forEach(s => {
    const { template } = s as { template: RawTemplate | RawTemplate[] | null };
    if (!template) return;
    const list = Array.isArray(template) ? template : [template];
    list.forEach(t => {
      if (t && !byId.has(t.id)) byId.set(t.id, t);
    });
  });
  return Array.from(byId.values());
}
