import { insertAccount } from "@/lib/supabase/accounts/insertAccount";
import { insertAccountInfo } from "@/lib/supabase/account_info/insertAccountInfo";
import {
  selectAccountWithSocials,
  type AccountWithSocials,
} from "@/lib/supabase/accounts/selectAccountWithSocials";
import { insertAccountArtistId } from "@/lib/supabase/account_artist_ids/insertAccountArtistId";
import { addArtistToOrganization } from "@/lib/supabase/artist_organization_ids/addArtistToOrganization";

/**
 * Result of creating an artist in the database.
 */
export type CreateArtistResult = AccountWithSocials & {
  account_id: string;
};

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

    return {
      ...artist,
      account_id: artist.id,
    };
  } catch (error) {
    return null;
  }
}
