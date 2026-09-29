import { z } from "zod";
import { selectSite } from "@/lib/supabase/sites/selectSite";
import { insertSiteActivity } from "@/lib/supabase/site_activity_events/insertSiteActivity";
import { SiteError } from "../SiteError";
export async function recordSiteActivity(siteId: string, input: unknown) {
  z.string().uuid().parse(siteId);
  const event = z
    .object({
      id: z.string().uuid(),
      visitId: z.string().uuid(),
      event: z.enum(["visit", "start", "complete", "replay", "share"]),
    })
    .strict()
    .parse(input);
  const site = await selectSite(siteId);
  if (!site?.published) throw new SiteError(404, "Site is not published");
  await insertSiteActivity({
    id: event.id,
    site_id: siteId,
    visit_id: event.visitId,
    event: event.event,
  });
  return { success: true };
}
