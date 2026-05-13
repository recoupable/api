import supabase from "@/lib/supabase/serverClient";

/**
 * Deletes every `template_shares` row for the given template id.
 *
 * Throws on database error so callers cannot silently continue with an
 * inconsistent share state.
 *
 * @param templateId - The template UUID
 * @throws If the Supabase delete fails.
 */
export async function deleteTemplateShares(templateId: string): Promise<void> {
  const { error } = await supabase
    .from("agent_template_shares")
    .delete()
    .eq("template_id", templateId);

  if (error) {
    console.error("Error deleting template_shares:", error);
    throw new Error(`deleteTemplateShares failed: ${error.message}`);
  }
}
