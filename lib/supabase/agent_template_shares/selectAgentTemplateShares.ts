import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

interface SelectAgentTemplateSharesParams {
  templateId?: string;
  accountId?: string;
}

/**
 * Selects rows from `agent_template_shares` matching the provided filters.
 * Both filters are optional but at least one should be supplied to avoid
 * scanning the whole table.
 *
 * Throws on database error so callers can't misread a query failure as
 * "no shares" (e.g. the toggle-favorite visibility check must distinguish
 * a transient DB failure from "this account isn't a sharee").
 *
 * @returns Array of matching share rows (may be empty).
 */
export async function selectAgentTemplateShares(
  params: SelectAgentTemplateSharesParams,
): Promise<Tables<"agent_template_shares">[]> {
  let query = supabase.from("agent_template_shares").select("*");
  if (params.templateId) query = query.eq("template_id", params.templateId);
  if (params.accountId) query = query.eq("user_id", params.accountId);

  const { data, error } = await query;
  if (error) {
    console.error("Error selecting agent_template_shares:", error);
    throw new Error(`selectAgentTemplateShares failed: ${error.message}`);
  }
  return data ?? [];
}
