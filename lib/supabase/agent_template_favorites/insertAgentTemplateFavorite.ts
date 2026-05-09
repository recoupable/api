import supabase from "@/lib/supabase/serverClient";

/**
 * Inserts a favorite row for `(template_id, user_id)`. Idempotent — a
 * pre-existing row (Postgres unique-violation 23505) is treated as success.
 *
 * @param templateId - The agent template UUID
 * @param userId - The favoriting account UUID
 * @returns True if the favorite exists after the call, false on unexpected error.
 */
export async function insertAgentTemplateFavorite(
  templateId: string,
  userId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("agent_template_favorites")
    .insert({ template_id: templateId, user_id: userId })
    .select("template_id")
    .maybeSingle();

  if (error && error.code !== "23505") {
    console.error("Error inserting agent_template_favorite:", error);
    return false;
  }

  return true;
}
