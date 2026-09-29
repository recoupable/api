import { takeSiteRequest } from "@/lib/supabase/site_activity_events/takeSiteRequest";
import { hashFanValue } from "../fanConnection/hashFanValue";
import { SiteError } from "../SiteError";
/** Site-wide ceiling also bounds abuse when requests rotate or spoof forwarding addresses. */
export async function limitSiteRequest(siteId: string, action: string, limit: number) {
  if (!(await takeSiteRequest(hashFanValue(`${siteId}:${action}`), limit)))
    throw new SiteError(429, "Too many requests. Please try again shortly.");
}
