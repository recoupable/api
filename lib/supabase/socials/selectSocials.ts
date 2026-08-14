import { Tables } from "@/types/database.types";
import supabase from "../serverClient";

type SelectSocialsParams = {
  id?: string;
  profile_url?: string;
  /**
   * Substring match (ilike) on profile_url. Use for Spotify-id lookups:
   * profile_url is stored inconsistently — with and without a scheme,
   * sometimes with a ?si= query — so the exact-match `profile_url` param
   * misses real matches (chat#1889 row 8).
   */
  profileUrlContains?: string;
};

/**
 * Selects socials from the database.
 *
 * @param params - The parameters for the query
 * @returns The socials
 * @throws Error if the query fails
 */
export async function selectSocials(
  params: SelectSocialsParams,
): Promise<Tables<"socials">[] | null> {
  let query = supabase.from("socials").select("*").order("updated_at", { ascending: false });

  if (params.id) {
    query = query.eq("id", params.id);
  }

  if (params.profile_url) {
    query = query.eq("profile_url", params.profile_url);
  }

  if (params.profileUrlContains) {
    query = query.ilike("profile_url", `%${params.profileUrlContains}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch socials: ${error.message}`);
  }

  return data || [];
}
