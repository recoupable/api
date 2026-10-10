import { generateDeveloperToken } from "@/lib/apple/generateDeveloperToken";
import { limitSiteRequest } from "@/lib/sites/activity/limitSiteRequest";
import { SiteError } from "@/lib/sites/SiteError";
/**
 * Public MusicKit browser token. Signing credentials never leave the API.
 *
 * @returns Origin-bound browser token, or an unavailable status.
 */
export async function GET() {
  const headers = {
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "https://app.recoupable.dev",
  };
  if (
    !["APPLE_MUSIC_PRIVATE_KEY", "APPLE_MUSIC_KEY_ID", "APPLE_MUSIC_TEAM_ID"].every(
      key => process.env[key],
    )
  )
    return Response.json({ configured: false }, { headers });
  try {
    await limitSiteRequest("recoup-musickit-player", "browser-config", 600);
    const developerToken = generateDeveloperToken({
      origin: ["https://app.recoupable.dev"],
      ttlSeconds: 600,
    });
    return Response.json({ configured: true, developerToken }, { headers });
  } catch (error) {
    const status = error instanceof SiteError && error.status === 429 ? 429 : 503;
    console.error("[sites:apple-config] Browser token unavailable", {
      category: error instanceof Error ? error.name : "unknown",
      status,
    });
    return Response.json({ configured: false }, { headers, status });
  }
}
