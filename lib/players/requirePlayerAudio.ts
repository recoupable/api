import { SiteError } from "@/lib/sites/SiteError";
import { selectPlayerAudio } from "@/lib/supabase/storage/selectPlayerAudio";
/** Only workspace-owned uploads can be published as a release-player fallback. */
export async function requirePlayerAudio(owner: string, url: string | null) {
  if (!url) return;
  if (!(await selectPlayerAudio(owner, url)))
    throw new SiteError(
      400,
      "Choose a workspace-owned MP3 or WAV uploaded through /api/sites/assets",
    );
}
