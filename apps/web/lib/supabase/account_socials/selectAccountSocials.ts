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
 * Selects account_socials rows with joined social data, filtered by
 * account id, social id, or both. Throws on DB error so callers fail
 * closed (e.g. access-control checks cannot be silently bypassed by
 * treating errors as "no links").
 *
 * @param accountId - Filter by owning account id.
 * @param socialId - Filter by social id.
 * @param offset - The number of records to skip.
 * @param limit - The maximum number of records to return.
 * @returns The matching rows with joined social data.
 * @throws Error if the query fails.
 */
export async function selectAccountSocials({
  accountId,
  socialId,
  offset = 0,
  limit = 100,
}: {
  accountId?: string;
  socialId?: string;
  offset?: number;
  limit?: number;
}): Promise<AccountSocialWithSocial[]> {
  let query = supabase
    .from("account_socials")
    .select(`*, social:socials!inner (*)`)
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (accountId) query = query.eq("account_id", accountId);
  if (socialId) query = query.eq("social_id", socialId);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch account socials: ${error.message}`);
  }

  return data ?? [];
}
