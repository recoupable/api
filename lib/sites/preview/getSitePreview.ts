import type { Site } from "../schema";
import { getSitePlaybackAudio } from "../getSitePlaybackAudio";
import { signSitePreview } from "./signSitePreview";
import { SiteError } from "../SiteError";
export async function getSitePreview(site: Site, accountId: string) {
  if (!site.draft) throw new SiteError(400, "Build a draft first");
  return {
    previewToken: signSitePreview(site.id, accountId),
    playbackAudioUrl: await getSitePlaybackAudio(site, site.draft),
  };
}
