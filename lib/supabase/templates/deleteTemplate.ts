import supabase from "@/lib/supabase/serverClient";

/**
 * Deletes an template row by id. Cascades remove dependent shares /
 * favorites at the database level.
 *
 * @param id - The template UUID
 * @returns True if the delete succeeded, false otherwise.
 */
export async function deleteTemplate(id: string): Promise<boolean> {
  const { error } = await supabase.from("agent_templates").delete().eq("id", id);

  if (error) {
    console.error("Error deleting template:", error);
    return false;
  }

  return true;
}
