import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Selects all agent_template_shares rows for the given template ids.
 *
 * @param templateIds - Array of agent template UUIDs
 * @returns Array of share rows (may be empty).
 */
export async function selectAgentTemplateShares(
  templateIds: string[],
): Promise<Tables<"agent_template_shares">[]> {
  if (!Array.isArray(templateIds) || templateIds.length === 0) return [];

  const { data, error } = await supabase
    .from("agent_template_shares")
    .select("*")
    .in("template_id", templateIds);

  if (error) {
    console.error("Error selecting agent_template_shares:", error);
    return [];
  }

  return data ?? [];
}
