import { initializeSiteBuild } from "./builder/initializeSiteBuild";
import { advanceSiteBuild } from "./builder/advanceSiteBuild";
import type { Site, SiteSnapshot } from "./schema";
/** Foreground callers share the same incremental builder; hosted jobs use durable turn steps. */
export async function generateSite(
  site: Site,
  instruction: string,
  accountId?: string,
): Promise<SiteSnapshot> {
  let state = await initializeSiteBuild(site, instruction, accountId);
  while (!state.snapshot) state = await advanceSiteBuild(state, accountId);
  return state.snapshot;
}
