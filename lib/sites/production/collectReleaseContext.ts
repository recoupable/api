import { readSiteContextBrief } from "./readSiteContextBrief";
import type { Site } from "../schema";
import { resolveReleaseContext } from "./resolveReleaseContext";
import { analyzeReleaseMusic } from "./analyzeReleaseMusic";
import { researchArtist } from "./researchArtist";
export async function collectReleaseContext(
  site: Site,
  accountId: string,
  contextBriefId?: string,
) {
  const selectedBrief = contextBriefId ?? site.draft?.production?.context.engine?.briefId;
  if (selectedBrief) return readSiteContextBrief(site, accountId, selectedBrief);
  const release = await resolveReleaseContext(site);
  const [music, research] = await Promise.all([
    analyzeReleaseMusic(site, release, accountId),
    researchArtist(release, accountId),
  ]);
  return { release, music, research };
}
