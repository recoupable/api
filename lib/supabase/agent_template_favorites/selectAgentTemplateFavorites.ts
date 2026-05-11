import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Selects raw `agent_template_favorites` rows for the given account.
 *
 * Returns an empty array on database error (and logs it). Callers that need
 * a Set of template ids should compose it themselves.
 */
export async function selectAgentTemplateFavorites(
  accountId: string,
): Promise<Tables<"agent_template_favorites">[]> {
  const { data, error } = await supabase
    .from("agent_template_favorites")
    .select("*")
    .eq("user_id", accountId);

  if (error) {
    console.error("Error selecting agent_template_favorites:", error);
    return [];
  }

  return data ?? [];
}
