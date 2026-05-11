import supabase from "@/lib/supabase/serverClient";

/**
 * Returns the set of template ids the given account has favorited.
 *
 * @param accountId - The account UUID
 * @returns Set of template ids; empty Set on no rows or on error.
 */
export async function selectAgentTemplateFavorites(accountId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("agent_template_favorites")
    .select("template_id")
    .eq("user_id", accountId);

  if (error) {
    console.error("Error selecting agent_template_favorites:", error);
    return new Set<string>();
  }

  return new Set<string>((data ?? []).map(row => row.template_id));
}
