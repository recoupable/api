import { generateBrandWorld } from "../brandWorld/generateBrandWorld";
import { getSiteModelOptions } from "../getSiteModelOptions";
import type { Site, SiteSnapshot } from "../schema";
import type { SiteBuildState } from "./types";
/** Persist the original task and art direction separately from disposable conversation. */
export async function initializeSiteBuild(
  site: Site,
  instruction: string,
  accountId?: string,
  existingWorld?: SiteSnapshot["brandWorld"],
): Promise<SiteBuildState> {
  if (accountId) await (await import("../production/requireCredits")).requireCredits(accountId);
  const brandWorld =
    existingWorld ??
    (await generateBrandWorld(site, instruction, getSiteModelOptions().model, accountId));
  return {
    site,
    instruction,
    brandWorld,
    files: {
      html: site.draft?.design.experience?.html ?? "",
      css: site.draft?.design.experience?.css ?? "",
      javascript: site.draft?.design.experience?.javascript ?? "",
    },
    notes: "",
    messages: [],
    inputTokens: 0,
    turns: 0,
    compactions: 0,
  };
}
