import supabase from "@/lib/supabase/serverClient";

/**
 * Removes the favorite row for `(template_id, account)`. Idempotent.
 *
 * @param templateId - The template UUID
 * @param accountId - The account UUID whose favorite is being removed
 * @returns True on success, false on database error.
 */
export async function deleteTemplateFavorite(
  templateId: string,
  accountId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("agent_template_favorites")
    .delete()
    .eq("template_id", templateId)
    .eq("user_id", accountId);

  if (error) {
    console.error("Error deleting template_favorite:", error);
    return false;
  }

  return true;
}
