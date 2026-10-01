import { siteExists } from "@/lib/supabase/sites/siteExists";
import { FatalError } from "workflow";
/** A deleted site must not advance into another billable production stage. */
export async function ensureSiteExistsStep(siteId: string) {
  "use step";
  if (!(await siteExists(siteId))) throw new FatalError("Site deleted. Production stopped.");
}
