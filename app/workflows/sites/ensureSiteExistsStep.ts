import { selectSite } from "@/lib/supabase/sites/selectSite";
import { FatalError } from "workflow";
/** A deleted site must not advance into another billable production stage. */
export async function ensureSiteExistsStep(siteId: string) {
  "use step";
  if (!(await selectSite(siteId))) throw new FatalError("Site deleted. Production stopped.");
}
