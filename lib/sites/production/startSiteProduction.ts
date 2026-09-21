import { updateSite } from "@/lib/supabase/sites/updateSite";
import { SiteError } from "../SiteError";
import { start } from "workflow/api";
import { siteProductionWorkflow } from "@/app/workflows/sites/siteProductionWorkflow";
import { signGenerationJob } from "./signGenerationJob";
import { requireCredits } from "./requireCredits";
import type { Site } from "../schema";
export async function startSiteProduction(site: Site, instruction: string, accountId: string) {
  await requireCredits(accountId);
  // Validate signing configuration before creating billable work.
  signGenerationJob("validate", site.id, accountId);
  const claimed = await updateSite(site.id, site.owner_id, site.revision, {});
  if (!claimed)
    throw new SiteError(
      409,
      "Generation already started or the site changed. Reload before trying again.",
    );
  const run = await start(siteProductionWorkflow, [claimed, instruction, accountId]);
  return {
    generation: {
      token: signGenerationJob(run.runId, site.id, accountId),
      status: "running" as const,
    },
  };
}
