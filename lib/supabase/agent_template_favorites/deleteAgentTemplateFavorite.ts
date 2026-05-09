import supabase from "@/lib/supabase/serverClient";

/**
 * Removes the favorite row for `(template_id, user_id)`. Idempotent.
 *
 * @param templateId - The agent template UUID
 * @param userId - The account UUID whose favorite is being removed
 * @returns True on success, false on database error.
 */
export async function deleteAgentTemplateFavorite(
  templateId: string,
  userId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("agent_template_favorites")
    .delete()
    .eq("template_id", templateId)
    .eq("user_id", userId);

  if (error) {
    console.error("Error deleting agent_template_favorite:", error);
    return false;
  }

  return true;
}
