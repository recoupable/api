import supabase from "@/lib/supabase/serverClient";
import type { Tables, TablesInsert } from "@/types/database.types";

export async function upsertResearchCacheEntry(
  entry: TablesInsert<"research_cache_entries">,
): Promise<Tables<"research_cache_entries"> | null> {
  const { data, error } = await supabase
    .from("research_cache_entries")
    .upsert(entry, { onConflict: "cache_key" })
    .select()
    .single();

  if (error) {
    console.error("[ERROR] upsertResearchCacheEntry:", error);
    return null;
  }

  return data;
}
