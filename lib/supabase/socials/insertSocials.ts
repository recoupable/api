import supabase from "../serverClient";
import type { Tables, TablesInsert } from "@/types/database.types";

/**
 * Strips null/undefined fields so upsert-on-conflict doesn't clobber
 * existing column values when a caller has nothing new to say about
 * those fields (e.g. the comments pipeline passes null for bio/region).
 */
const stripNullish = (row: TablesInsert<"socials">): TablesInsert<"socials"> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out as TablesInsert<"socials">;
};

/**
 * Inserts one or more social records. Upserts on `profile_url`;
 * null/undefined fields are dropped so we don't overwrite existing
 * non-null values with nulls.
 *
 * @param socials - Array of social data to insert
 * @returns Array of inserted social records
 */
export async function insertSocials(
  socials: TablesInsert<"socials">[],
): Promise<Tables<"socials">[]> {
  const { data, error } = await supabase
    .from("socials")
    .upsert(socials.map(stripNullish), { onConflict: "profile_url" })
    .select("*");

  if (error) {
    console.error("[ERROR] insertSocials:", error);
    return [];
  }

  return data || [];
}
