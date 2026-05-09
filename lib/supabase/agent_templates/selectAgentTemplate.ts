import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Selects a single agent template by id.
 *
 * @param id - The agent template UUID
 * @returns The matching agent_templates row or null if not found / on error.
 */
export async function selectAgentTemplate(id: string): Promise<Tables<"agent_templates"> | null> {
  const { data, error } = await supabase
    .from("agent_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Error selecting agent template:", error);
    return null;
  }

  return data;
}
