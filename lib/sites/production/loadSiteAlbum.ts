import { z } from "zod";
import { collectSpotifyReleaseContext } from "@/lib/context/providers/collectSpotifyReleaseContext";
import { parseContextReleaseUrl } from "@/lib/context/parseContextReleaseUrl";
import { authorizeSiteWorkspace } from "../authorizeSiteWorkspace";
import type { Site } from "../schema";
import type { ReleaseContext } from "./schema";
/** Enumerate the complete album before starting any paid track analysis. */
export async function loadSiteAlbum(site: Site, accountId: string) {
  await authorizeSiteWorkspace(accountId, site.owner_id);
  const locator = parseContextReleaseUrl(site.release_url);
  const { default: generateAccessToken } = await import("@/lib/spotify/generateAccessToken");
  const token = await generateAccessToken();
  if (!token.access_token) throw new Error("Spotify album access unavailable");
  const result = await collectSpotifyReleaseContext(
    { releaseId: locator.id, maxPages: 50 },
    token.access_token,
  );
  if (result.trackCoverage.extent !== "full")
    throw new Error("The complete album track list is unavailable");
  const metadata = z
    .object({
      name: z.string(),
      artists: z.array(z.object({ name: z.string() })),
      images: z.array(z.object({ url: z.string() })),
      release_date: z.string().optional(),
    })
    .parse(result.album);
  const trackSchema = z.object({
    id: z.string().regex(/^[A-Za-z0-9]{22}$/),
    name: z.string(),
    track_number: z.number(),
    disc_number: z.number(),
    is_local: z.boolean().optional(),
  });
  const gaps = [...result.gaps];
  const tracks = result.tracks.flatMap((value, index) => {
    const parsed = trackSchema.safeParse(value);
    if (!parsed.success || parsed.data.is_local) {
      gaps.push(`Track slot ${index + 1} is unavailable for recording analysis`);
      return [];
    }
    return [{ ...parsed.data, url: `https://open.spotify.com/track/${parsed.data.id}` }];
  });
  if (!tracks.length) throw new Error("Album has no available recordings to analyze");
  const release: ReleaseContext["release"] = {
    url: locator.url,
    title: metadata.name,
    artists: metadata.artists.map(a => a.name),
    artwork: metadata.images[0]?.url ?? null,
    date: metadata.release_date ?? null,
    isrc: null,
    previewUrl: null,
  };
  return { release, tracks, gaps };
}
