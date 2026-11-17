import { z } from "zod";
import { selectSite } from "@/lib/supabase/sites/selectSite";
import { authorizeSiteWorkspace } from "../../authorizeSiteWorkspace";
import { SiteError } from "../../SiteError";
import { readPublishableBuild } from "../readPublishableBuild";
import { getSitePublishIdentity } from "../getSitePublishIdentity";
import type { SitePublicationSelection } from "./selectedSitePublicationSchema";
/** Selection fields are expectations, never authority or a request-body snapshot. */
export async function resolveSelectedSiteCandidate(
  accountId: string,
  selection: SitePublicationSelection,
) {
  if (!accountId) throw new SiteError(401, "Authentication required");
  const site = await selectSite(selection.siteId);
  if (!site) throw new SiteError(404, "Site not found");
  await authorizeSiteWorkspace(accountId, site.owner_id);
  const pointer = z
    .uuid()
    .nullable()
    .safeParse((site as unknown as Record<string, unknown>).published_evidence_id);
  if (!pointer.success) throw new SiteError(503, "Publication pointer metadata unavailable");
  if (
    pointer.data !== selection.expectedPublishedEvidenceId ||
    site.id !== selection.siteId ||
    site.owner_id !== selection.ownerId ||
    site.revision !== selection.revision ||
    site.artist_id !== selection.artistId
  )
    throw new SiteError(409, "Selected site or publication metadata changed or is unavailable");
  const candidate = selection.generationToken
    ? await readPublishableBuild(selection.generationToken, site, accountId)
    : site.draft;
  if (!candidate?.design.experience) throw new SiteError(409, "Selected preview unavailable");
  const identity = getSitePublishIdentity({
    siteId: site.id,
    ownerId: site.owner_id,
    revision: site.revision,
    candidate,
  });
  if (identity.candidateSha256 !== selection.candidateSha256)
    throw new SiteError(409, "Selected preview changed; select it again before publishing");
  return { site, candidate: structuredClone(candidate), identity };
}
