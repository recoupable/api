import type { AccountWithSocials } from "@/lib/supabase/accounts/selectAccountWithSocials";
import { createArtistWithRoster } from "@/lib/supabase/artists/createArtistWithRoster";

export type CreateArtistResult = AccountWithSocials & { account_id: string };

/** Creates a name-only artist atomically; names do not establish shared identity. */
export async function createArtistInDb(
  name: string,
  accountId: string,
  organizationId?: string,
): Promise<CreateArtistResult | null> {
  try {
    return await createArtistWithRoster(name, accountId, organizationId);
  } catch {
    return null;
  }
}
