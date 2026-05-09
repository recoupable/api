import supabase from "@/lib/supabase/serverClient";

/**
 * Template ids favorited by the account.
 */
export async function selectFavoriteTemplateIds(accountId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("agent_template_favorites")
    .select("template_id")
    .eq("user_id", accountId);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map(f => f.template_id));
}
