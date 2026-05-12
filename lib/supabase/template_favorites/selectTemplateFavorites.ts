import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Selects raw `template_favorites` rows for the given account. Throws on
 * database error so callers can distinguish a real failure from "account
 * has no favorites".
 */
export async function selectTemplateFavorites(
  accountId: string,
): Promise<Tables<"agent_template_favorites">[]> {
  const { data, error } = await supabase
    .from("agent_template_favorites")
    .select("*")
    .eq("user_id", accountId);

  if (error) {
    console.error("Error selecting template_favorites:", error);
    throw new Error(`selectTemplateFavorites failed: ${error.message}`);
  }

  return data ?? [];
}
