import supabase from "../serverClient";
import { stripNullish } from "@/lib/objects/stripNullish";
import type { TablesInsert } from "@/types/database.types";

/**
 * Inserts one or more social records. Upserts on `profile_url`;
 * null/undefined fields are dropped so we don't overwrite existing
 * non-null values with nulls.
 *
 * @param socials - Array of social data to insert
 * @returns Array of inserted social records
 */
export async function insertSocials(socials: TablesInsert<"socials">[]) {
  // stripNullish drops keys, so the inferred type widens to Partial<…>;
  // cast back since the supabase upsert overload still expects the full
  // insert type even though missing optional fields are fine at runtime.
  const cleaned = socials.map(stripNullish) as TablesInsert<"socials">[];
  const { data, error } = await supabase
    .from("socials")
    .upsert(cleaned, { onConflict: "profile_url" })
    .select("*");

  if (error) {
    console.error("[ERROR] insertSocials:", error);
    throw error;
  }

  return data || [];
}
