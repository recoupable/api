import supabase from "../serverClient";
import { Tables } from "@/types/database.types";

type AccountSocialRow = Tables<"account_socials">;
type SocialRow = Tables<"socials">;

/**
 * Type for the Supabase query result with joined socials
 * Supabase infers joined relationships as arrays, but this is a one-to-one relationship
 * so at runtime `social` is a single object, not an array.
 */
export type AccountSocialWithSocial = AccountSocialRow & {
  social: SocialRow | null;
};

/**
 * Selects account socials with joined social data, filtered by artist account ID.
 *
 * @param artist_account_id - The unique identifier of the artist account
 * @param offset - The number of records to skip
 * @param limit - The maximum number of records to return
 * @returns The query results with joined social data
 * @throws Error if the query fails
 */
export async function selectAccountSocials(
  artist_account_id: string,
  offset: number = 0,
  limit: number = 100,
): Promise<AccountSocialWithSocial[] | null> {
  const { data, error } = await supabase
    .from("account_socials")
    .select(
      `*,
      social:socials!inner (*)
    `,
    )
    .eq("account_id", artist_account_id)
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch account socials: ${error.message}`);
  }

  return data;
}
