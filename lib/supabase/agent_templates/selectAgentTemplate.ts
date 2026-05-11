import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Selects a single agent template by id.
 *
 * Returns `null` only when the row does not exist. Database errors are thrown
 * so callers can distinguish a real failure from a missing row (and surface
 * a 500 instead of a false 404).
 *
 * @param id - The agent template UUID
 * @returns The matching agent_templates row, or null if not found.
 * @throws If the Supabase query fails.
 */
export async function selectAgentTemplate(id: string): Promise<Tables<"agent_templates"> | null> {
  const { data, error } = await supabase
    .from("agent_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Error selecting agent template:", error);
    throw new Error(`selectAgentTemplate failed: ${error.message}`);
  }

  return data;
}
