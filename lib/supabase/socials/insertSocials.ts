import supabase from "../serverClient";
import type { Tables, TablesInsert } from "@/types/database.types";

/**
 * Inserts one or more social records.
 *
 * @param socials - Array of social data to insert
 * @returns Array of inserted social records
 */
export async function insertSocials(
  socials: TablesInsert<"socials">[],
): Promise<Tables<"socials">[]> {
  const { data, error } = await supabase.from("socials").insert(socials).select("*");

  if (error) {
    console.error("[ERROR] insertSocials:", error);
    return [];
  }

  return data || [];
}
