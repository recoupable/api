import { Tables } from "@/types/database.types";
import supabase from "../serverClient";

type SelectSocialsParams = {
  id?: string;
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

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch socials: ${error.message}`);
  }

  return data || [];
}
