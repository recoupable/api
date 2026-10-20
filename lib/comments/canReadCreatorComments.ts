import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { selectArtistOrganizationIds } from "@/lib/supabase/artist_organization_ids/selectArtistOrganizationIds";

/** Reuse roster access; also allow the creator itself or its owning organization key. */
export async function canReadCreatorComments(
  accountId: string,
  creatorId: string,
): Promise<boolean> {
  if (accountId === creatorId) return true;
  if (await checkAccountArtistAccess(accountId, creatorId)) return true;
  const organizations = await selectArtistOrganizationIds(creatorId);
  return organizations?.some(row => row.organization_id === accountId) ?? false;
}
