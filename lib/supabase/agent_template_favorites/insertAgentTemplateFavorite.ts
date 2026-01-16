import supabase from "@/lib/supabase/serverClient";

/**
 * Insert an agent template favorite for a user
 *
 * @param params - The parameters for the insert
 * @param params.templateId - The ID of the template to favorite
 * @param params.userId - The ID of the user adding the favorite
 * @returns An object with success: true
 * @throws Error if the database operation fails (except for duplicate entries)
 */
export default async function insertAgentTemplateFavorite({
  templateId,
  userId,
}: {
  templateId: string;
  userId: string;
}): Promise<{ success: true }> {
  const { error } = await supabase
    .from("agent_template_favorites")
    .insert({ template_id: templateId, user_id: userId })
    .select("template_id")
    .maybeSingle();

  // Ignore unique violation (23505) - user already favorited this template
  if (error && error.code !== "23505") {
    throw error;
  }

  return { success: true };
}
