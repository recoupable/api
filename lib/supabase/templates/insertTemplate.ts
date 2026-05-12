import supabase from "@/lib/supabase/serverClient";
import type { Tables, TablesInsert } from "@/types/database.types";

/**
 * Inserts a new template row.
 *
 * @param row - The template insert payload (must include creator).
 * @returns The newly created templates row, or null on error.
 */
export async function insertTemplate(
  row: TablesInsert<"agent_templates">,
): Promise<Tables<"agent_templates"> | null> {
  const { data, error } = await supabase.from("agent_templates").insert(row).select("*").single();

  if (error) {
    console.error("Error inserting template:", error);
    return null;
  }

  return data;
}
