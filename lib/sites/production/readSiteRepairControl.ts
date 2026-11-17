import { selectSite } from "@/lib/supabase/sites/selectSite";
import { authorizeSiteWorkspace } from "../authorizeSiteWorkspace";
import { SiteError } from "../SiteError";
import type { Site } from "../schema";

/** Recheck the existing workspace and revision before admitting another repair stage. */
export async function readSiteRepairControl(site: Site, accountId: string) {
  const current = await selectSite(site.id);
  if (!current) return { revision: site.revision, cancelled: true };
  if (current.owner_id !== site.owner_id)
    throw new SiteError(409, "Site workspace changed. Reload before editing.");
  await authorizeSiteWorkspace(accountId, current.owner_id);
  return { revision: current.revision, cancelled: false };
}
