import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

export async function selectResearchCacheEntry(
  cacheKey: string,
): Promise<Tables<"research_cache_entries"> | null> {
  const { data, error } = await supabase
    .from("research_cache_entries")
    .select("*")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (error) {
    console.error("[ERROR] selectResearchCacheEntry:", error);
    return null;
  }

  return data;
}
