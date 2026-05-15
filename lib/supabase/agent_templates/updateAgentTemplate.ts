import supabase from "@/lib/supabase/serverClient";
import type { Tables, TablesUpdate } from "@/types/database.types";

/**
 * Applies a partial update to an template row, refreshing `updated_at`.
 *
 * @param id - The template UUID
 * @param updates - Partial column updates
 * @returns The updated row, or null on error.
 */
export async function updateAgentTemplate(
  id: string,
  updates: TablesUpdate<"agent_templates">,
): Promise<Tables<"agent_templates"> | null> {
  const { data, error } = await supabase
    .from("agent_templates")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Error updating template:", error);
    return null;
  }

  return data;
}
