import supabase from "@/lib/supabase/serverClient";

/**
 * Deletes every `agent_template_shares` row for the given template id.
 *
 * @param templateId - The agent template UUID
 * @returns True on success, false on database error.
 */
export async function deleteAgentTemplateShares(templateId: string): Promise<boolean> {
  const { error } = await supabase
    .from("agent_template_shares")
    .delete()
    .eq("template_id", templateId);

  if (error) {
    console.error("Error deleting agent_template_shares:", error);
    return false;
  }

  return true;
}
