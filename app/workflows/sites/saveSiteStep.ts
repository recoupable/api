import { readSiteContextBrief } from "@/lib/sites/production/readSiteContextBrief";
import { updateSite } from "@/lib/supabase/sites/updateSite";
import { authorizeSiteWorkspace } from "@/lib/sites/authorizeSiteWorkspace";
import type { Site, SiteSnapshot } from "@/lib/sites/schema";
import { FatalError } from "workflow";
export async function saveSiteStep(site: Site, draft: SiteSnapshot, accountId: string) {
  "use step";
  await authorizeSiteWorkspace(accountId, site.owner_id);
  const briefId = draft.production?.context.engine?.briefId;
  if (briefId) await readSiteContextBrief(site, accountId, briefId);
  const updated = await updateSite(site.id, site.owner_id, site.revision, { draft });
  if (!updated)
    throw new FatalError("Site changed during generation. The newer draft was preserved.");
  return { site: updated };
}
