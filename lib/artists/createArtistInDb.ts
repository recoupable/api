import { insertAccount } from "@/lib/supabase/accounts/insertAccount";
import { insertAccountInfo } from "@/lib/supabase/account_info/insertAccountInfo";
import { selectAccountWithSocials } from "@/lib/supabase/accounts/selectAccountWithSocials";
import { insertAccountArtistId } from "@/lib/supabase/account_artist_ids/insertAccountArtistId";
import { addArtistToOrganization } from "@/lib/supabase/artist_organization_ids/addArtistToOrganization";

/**
 * Result of creating an artist in the database.
 */
export interface CreateArtistResult {
  id: string;
  account_id: string;
  name: string | null;
  created_at: string | null;
  updated_at: string | null;
  image: string | null;
  instruction: string | null;
  knowledges: unknown;
  label: string | null;
  organization: string | null;
  company_name: string | null;
  job_title: string | null;
  role_type: string | null;
  onboarding_status: unknown;
  onboarding_data: unknown;
  account_info: unknown[];
  account_socials: unknown[];
}

/**
 * Create a new artist account in the database and associate it with an owner account.
 *
 * @param name - Name of the artist to create
 * @param accountId - ID of the owner account that will have access to this artist
 * @param organizationId - Optional organization ID to link the new artist to
 * @returns Created artist object or null if creation failed
 */
export async function createArtistInDb(
  name: string,
  accountId: string,
  organizationId?: string,
): Promise<CreateArtistResult | null> {
  try {
    // Step 1: Create the account
    const account = await insertAccount({ name });

    // Step 2: Create account info for the account
    const accountInfo = await insertAccountInfo({ account_id: account.id });
    if (!accountInfo) return null;

    // Step 3: Get the full account data with socials and info
    const artist = await selectAccountWithSocials(account.id);
    if (!artist) return null;

    // Step 4: Associate the artist with the owner via account_artist_ids
    await insertAccountArtistId(accountId, account.id);

    // Step 5: Link to organization if provided
    if (organizationId) {
      await addArtistToOrganization(account.id, organizationId);
    }

    // Build return object by explicitly picking fields
    const info = artist.account_info?.[0];

    return {
      id: artist.id,
      account_id: artist.id,
      name: artist.name,
      created_at: artist.created_at,
      updated_at: artist.updated_at,
      image: info?.image ?? null,
      instruction: info?.instruction ?? null,
      knowledges: info?.knowledges ?? null,
      label: info?.label ?? null,
      organization: info?.organization ?? null,
      company_name: info?.company_name ?? null,
      job_title: info?.job_title ?? null,
      role_type: info?.role_type ?? null,
      onboarding_status: info?.onboarding_status ?? null,
      onboarding_data: info?.onboarding_data ?? null,
      account_info: artist.account_info,
      account_socials: artist.account_socials,
    };
  } catch (error) {
    return null;
  }
}
