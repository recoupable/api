import { selectArtistOrganizationIds } from "@/lib/supabase/artist_organization_ids/selectArtistOrganizationIds";
import { siteOperationSchemas, type SiteOperation } from "./siteOperationSchemas";
import { authorizeSiteWorkspace } from "./authorizeSiteWorkspace";
import { SiteError } from "./SiteError";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { selectSite } from "@/lib/supabase/sites/selectSite";
import { selectSites } from "@/lib/supabase/sites/selectSites";
import { selectSignups } from "@/lib/supabase/sites/selectSignups";
import { insertSite } from "@/lib/supabase/sites/insertSite";
import { updateSite } from "@/lib/supabase/sites/updateSite";
import { startSiteProduction } from "./production/startSiteProduction";
import { getSiteProduction } from "./production/getSiteProduction";
import { produceSite } from "./production/produceSite";
import { resolveSpotifyRelease } from "./resolveSpotifyRelease";
import { validateSiteAssets } from "./validateSiteAssets";
/** Shared authenticated operations for HTTP and MCP. Never accepts a caller identity in input. */
export async function processSiteOperation(
  accountId: string,
  operation: SiteOperation,
  raw: unknown,
) {
  if (!accountId) throw new SiteError(401, "Authentication required");
  if (operation === "list") {
    const input = siteOperationSchemas.list.parse(raw);
    const owner = await authorizeSiteWorkspace(accountId, input.organizationId);
    return { sites: await selectSites(owner, input.artistId) };
  }
  if (operation === "create") {
    const input = siteOperationSchemas.create.parse(raw);
    const owner = await authorizeSiteWorkspace(accountId, input.organizationId);
    if (!validateSiteAssets(input.assets, owner))
      throw new SiteError(400, "Upload assets to this workspace first");
    if (input.artistId) {
      const organizations = await selectArtistOrganizationIds(input.artistId);
      const belongsToOwner = organizations?.some(row => row.organization_id === owner) ?? false;
      const hasAccess = input.organizationId
        ? belongsToOwner
        : belongsToOwner || (await checkAccountArtistAccess(accountId, input.artistId));
      if (!hasAccess) throw new SiteError(403, "Artist not available in this workspace");
    }
    let release;
    if (input.releaseUrl) {
      try {
        release = await resolveSpotifyRelease(input.releaseUrl);
      } catch {
        throw new SiteError(
          422,
          "Could not read that Spotify release. Use a track, album, or playlist link and try again.",
        );
      }
    }
    const assets =
      release?.artwork && !input.assets.some(a => a.url === release.artwork)
        ? [
            {
              url: release.artwork,
              name: release.title.slice(0, 190) + " artwork",
              type: "image" as const,
            },
            ...input.assets,
          ].slice(0, 8)
        : input.assets;
    const site = await insertSite({
      owner_id: owner,
      created_by: accountId,
      artist_id: input.artistId,
      name: input.name || release!.title.slice(0, 120),
      brief:
        input.brief ||
        "Create a distinctive fan experience inspired by this release, its music, artwork and artist. Choose the strongest concept and format; it does not have to be a game. Make it worth sharing and easy to use on a phone.",
      release_url: release?.url || input.releaseUrl,
      assets,
    });
    return { site };
  }
  const input = siteOperationSchemas[operation].parse(raw);
  const site = await selectSite(input.id);
  if (!site) throw new SiteError(404, "Site not found");
  await authorizeSiteWorkspace(accountId, site.owner_id);
  if (operation === "get") return { site };
  if (operation === "generation" && "token" in input)
    return getSiteProduction(String(input.token), site.id, accountId);
  if (operation === "signups") return { signups: await selectSignups(site.id) };
  if (!("revision" in input) || input.revision !== site.revision)
    throw new SiteError(409, "This site changed. Reload before editing.");
  if (operation === "publish" && !site.draft)
    throw new SiteError(400, "Generate a preview before publishing");
  if (
    operation === "generate" &&
    "background" in input &&
    input.background &&
    "instruction" in input
  )
    return startSiteProduction(site, String(input.instruction || site.brief), accountId);
  const changes =
    operation === "generate" && "instruction" in input
      ? { draft: await produceSite(site, String(input.instruction), accountId) }
      : operation === "publish"
        ? { published: site.draft, published_at: new Date().toISOString() }
        : { published: null, published_at: null };
  const updated = await updateSite(site.id, site.owner_id, site.revision, changes);
  if (!updated)
    throw new SiteError(409, "This site changed while you were editing. Reload before editing.");
  return { site: updated };
}
