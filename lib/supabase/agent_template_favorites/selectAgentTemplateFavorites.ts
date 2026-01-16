import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

// DRY: Use database types instead of custom interfaces
export type AgentTemplateFavorite = Tables<"agent_template_favorites">;

/**
 * Select agent template favorites for a user
 *
 * @param params - The parameters for the query
 * @param params.userId - The user ID to get favorites for
 * @returns Array of favorite records
 */
export default async function selectAgentTemplateFavorites({
  userId,
}: {
  userId?: string;
}): Promise<AgentTemplateFavorite[]> {
  const hasUserId = typeof userId === "string" && userId.length > 0;

  // If no userId is provided, return empty array
  if (!hasUserId) {
    return [];
  }

  // DRY: Use select('*') instead of explicit columns
  const { data, error } = await supabase
    .from("agent_template_favorites")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return data || [];
}
