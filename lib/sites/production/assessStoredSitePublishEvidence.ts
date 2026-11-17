import { selectSite } from "@/lib/supabase/sites/selectSite";
import { selectSitePublishEvidence } from "@/lib/supabase/site_publish_evidence/selectSitePublishEvidence";
import { authorizeSiteWorkspace } from "../authorizeSiteWorkspace";
import { SiteError } from "../SiteError";
import { assessSitePublishEvidence } from "./assessSitePublishEvidence";
import { readPublishableBuild } from "./readPublishableBuild";

/** UNWIRED assessment only. Full publish/artist/context authorization remains separate. */
export async function assessStoredSitePublishEvidence(
  accountId: string,
  request: {
    siteId: string;
    revision: number;
    evidenceId: string;
    generationToken?: string;
  },
) {
  return assessSitePublishEvidence(request, {
    accountId,
    readCandidate: async ({ siteId }) => {
      const site = await selectSite(siteId);
      if (!site) throw new SiteError(404, "Site not found");
      await authorizeSiteWorkspace(accountId, site.owner_id);
      const candidate = request.generationToken
        ? await readPublishableBuild(request.generationToken, site, accountId)
        : site.draft;
      if (!candidate) throw new SiteError(409, "Site candidate unavailable");
      return { siteId: site.id, ownerId: site.owner_id, revision: site.revision, candidate };
    },
    readEvidence: scope => selectSitePublishEvidence({ ...scope, accountId }),
    now: Date.now,
  });
}
