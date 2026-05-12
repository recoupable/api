import supabase from "@/lib/supabase/serverClient";

/**
 * Inserts a favorite row for `(template_id, account)`. Idempotent — a
 * pre-existing row (Postgres unique-violation 23505) is treated as success.
 *
 * @param templateId - The template UUID
 * @param accountId - The favoriting account UUID
 * @returns True if the favorite exists after the call, false on unexpected error.
 */
export async function insertTemplateFavorite(
  templateId: string,
  accountId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("agent_template_favorites")
    .insert({ template_id: templateId, user_id: accountId })
    .select("template_id")
    .maybeSingle();

  if (error && error.code !== "23505") {
    console.error("Error inserting template_favorite:", error);
    return false;
  }

  return true;
}
