import { selectArtistOrganizationIds } from "@/lib/supabase/artist_organization_ids/selectArtistOrganizationIds";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { selectFanConfig } from "@/lib/supabase/site_fan_connections/selectFanConfig";
import { readPaidSiteSubscription } from "../../fanConnection/readPaidSiteSubscription";
import { getFanOAuthConfig } from "../../fanConnection/getFanOAuthConfig";
import { resolveSiteFanReturnUrl } from "../../fanConnection/resolveSiteFanReturnUrl";
import { readSiteContextBrief } from "../readSiteContextBrief";
import { SiteError } from "../../SiteError";
import type { Site, SiteSnapshot } from "../../schema";
/** Read-only authority checks; unsupported artist/configuration writes are rejected. */
export async function authorizeSelectedSitePublication(
  accountId: string,
  resolved: {
    site: Site;
    candidate: SiteSnapshot;
  },
  returnUrl?: string,
) {
  const { site, candidate } = resolved;
  const briefId = candidate.production?.context.engine?.briefId;
  if (briefId) await readSiteContextBrief(site, accountId, briefId);
  if (!site.artist_id)
    throw new SiteError(409, "Artist attribution must be prepared before publication");
  const organizations = await selectArtistOrganizationIds(site.artist_id);
  const belongs = organizations?.some(row => row.organization_id === site.owner_id) ?? false;
  const personalAccess =
    site.owner_id === accountId && (await checkAccountArtistAccess(accountId, site.artist_id));
  if (!belongs && !personalAccess)
    throw new SiteError(403, "Artist not available in this workspace");
  if (!(await readPaidSiteSubscription(site.owner_id)))
    throw new SiteError(402, "Paid site entitlement unavailable");
  getFanOAuthConfig();
  const config = await selectFanConfig(site.id);
  const destination = resolveSiteFanReturnUrl(site.id, config?.return_url, returnUrl);
  if (!config?.enabled || config.site_id !== site.id || config.return_url !== destination)
    throw new SiteError(409, "Fan connection must already be prepared for this destination");
  const [artist] = await selectAccounts(site.artist_id);
  if (!artist?.name?.trim()) throw new SiteError(400, "Add the artist's name before publishing");
}
