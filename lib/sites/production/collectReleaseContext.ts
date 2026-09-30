import { loadSiteAlbum } from "./loadSiteAlbum";
import { combineAlbumContext } from "./combineAlbumContext";
import type { ReleaseContext } from "./schema";
import { prepareSiteContext } from "./prepareSiteContext";
import { acquireSiteContextAudio } from "./acquireSiteContextAudio";
import { analyzeSiteContextAudio } from "./analyzeSiteContextAudio";
import { enrichSiteContext } from "./enrichSiteContext";
import { saveSiteContextBrief } from "./saveSiteContextBrief";
import { readSiteContextBrief } from "./readSiteContextBrief";
import type { Site } from "../schema";
import { resolveReleaseContext } from "./resolveReleaseContext";
import { analyzeReleaseMusic } from "./analyzeReleaseMusic";
import { researchArtist } from "./researchArtist";
export async function collectReleaseContext(
  site: Site,
  accountId: string,
  contextBriefId?: string,
  albumTrack = false,
): Promise<ReleaseContext> {
  const selectedBrief = contextBriefId ?? site.draft?.production?.context.engine?.briefId;
  if (selectedBrief) return readSiteContextBrief(site, accountId, selectedBrief);
  if (/^https:\/\/open\.spotify\.com\/album\//.test(site.release_url)) {
    const album = await loadSiteAlbum(site, accountId);
    const tracks: ReleaseContext[] = [];
    for (const track of album.tracks) {
      tracks.push(
        await collectReleaseContext(
          { ...site, release_url: track.url, draft: null },
          accountId,
          undefined,
          true,
        ),
      );
    }
    return combineAlbumContext(album, tracks);
  }
  if (/^https:\/\/open\.spotify\.com\/track\//.test(site.release_url)) {
    const saved = await prepareSiteContext(site, accountId, albumTrack);
    await acquireSiteContextAudio(site, accountId, saved);
    await analyzeSiteContextAudio(site, accountId, saved, "lyrics");
    await analyzeSiteContextAudio(site, accountId, saved, "summary");
    await enrichSiteContext(site, accountId, saved, "artwork_branding");
    await enrichSiteContext(site, accountId, saved, "artist_research");
    return saveSiteContextBrief(site, accountId, saved);
  }
  const release = await resolveReleaseContext(site);
  const [music, research] = await Promise.all([
    analyzeReleaseMusic(site, release, accountId),
    researchArtist(release, accountId),
  ]);
  return { release, music, research };
}
