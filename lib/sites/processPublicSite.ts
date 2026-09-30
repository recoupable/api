import { getSitePlaybackAudio } from "./getSitePlaybackAudio";
import { selectFanConfig } from "@/lib/supabase/site_fan_connections/selectFanConfig";
import { getFanOAuthConfig } from "./fanConnection/getFanOAuthConfig";
import { z } from "zod";
import { selectSite } from "@/lib/supabase/sites/selectSite";
import { insertSignup } from "@/lib/supabase/sites/insertSignup";
import { SiteError } from "./SiteError";
const signup = z
  .object({
    email: z.string().trim().email().max(254),
    consent: z.literal("yes"),
    website: z.literal("").optional(),
  })
  .strict();
/** Expose only the published snapshot. Never return owner data, draft or fan emails. */
export async function processPublicSite(id: string, input?: unknown) {
  z.string().uuid().parse(id);
  const parsed = input === undefined ? undefined : signup.parse(input);
  const site = await selectSite(id);
  if (!site?.published) throw new SiteError(404, "This site is not published.");
  if (parsed) {
    await insertSignup(
      id,
      parsed.email,
      `I agree to receive email updates from ${site.published.name}.`,
    );
    return { success: true };
  }
  // Internal creative guidance can contain customer instructions; never publish it.
  const snapshot = { ...site.published };
  snapshot.artistName =
    site.published.production?.context?.release?.artists?.join(", ") || snapshot.artistName;
  delete snapshot.brandWorld;
  delete snapshot.production;
  const config = await selectFanConfig(id);
  const fanConnectUrl = config?.enabled
    ? `${getFanOAuthConfig().origin}/api/sites/public/${id}/spotify`
    : null;
  return { snapshot, fanConnectUrl, playbackAudioUrl: await getSitePlaybackAudio(site) };
}
