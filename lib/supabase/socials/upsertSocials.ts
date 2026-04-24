import supabase from "@/lib/supabase/serverClient";
import type { Tables, TablesInsert } from "@/types/database.types";

/**
 * Upserts social profiles by `profile_url`.
 *
 * @param socials - Rows to upsert.
 * @returns The upserted rows, or `[]` on error.
 */
export async function upsertSocials(
  socials: TablesInsert<"socials">[],
): Promise<Tables<"socials">[]> {
  const { data, error } = await supabase
    .from("socials")
    .upsert(socials, { onConflict: "profile_url" })
    .select("*");

  if (error) {
    console.error("[ERROR] upsertSocials:", error);
    return [];
  }

  return data || [];
}
