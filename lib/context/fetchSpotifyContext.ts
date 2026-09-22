import { z } from "zod";

const providerId = z.string().regex(/^[A-Za-z0-9]{22}$/);
const trackSchema = z.object({
  id: providerId,
  name: z.string().min(1),
  duration_ms: z.number().positive(),
  disc_number: z.number().int().positive().optional(),
  track_number: z.number().int().positive().optional(),
  external_ids: z.object({ isrc: z.string().regex(/^[A-Za-z]{2}[A-Za-z0-9]{3}[0-9]{7}$/) }),
  artists: z.array(z.object({ id: providerId, name: z.string().min(1) })).min(1),
  album: z.object({
    id: providerId,
    name: z.string(),
    album_type: z.enum(["album", "single", "compilation"]).optional(),
    images: z.array(z.object({ url: z.string().url() })),
    release_date: z.string().optional(),
    release_date_precision: z.enum(["year", "month", "day"]).optional(),
  }),
  preview_url: z.string().url().nullable().optional(),
});
export type SpotifyContext = Awaited<ReturnType<typeof fetchSpotifyContext>>;

/** Fetch source facts only. Does not infer sound, lyrics, beliefs or brand from a title. */
export async function fetchSpotifyContext(
  id: string,
  accessToken: string,
  fetcher: typeof fetch = fetch,
) {
  providerId.parse(id);
  const response = await fetcher(`https://api.spotify.com/v1/tracks/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Spotify metadata request failed: ${response.status}`);
  const raw: unknown = await response.json();
  const track = trackSchema.parse(raw);
  if (track.id !== id)
    throw new Error("Spotify returned a different recording; identity review required");
  return {
    trackId: track.id,
    title: track.name,
    isrc: track.external_ids.isrc.toUpperCase(),
    durationSeconds: track.duration_ms / 1000,
    releaseTrack: {
      discNumber: track.disc_number ?? null,
      trackNumber: track.track_number ?? null,
    },
    artists: track.artists,
    release: {
      id: track.album.id,
      title: track.album.name,
      providerType: track.album.album_type ?? null,
      date: track.album.release_date ?? null,
      datePrecision: track.album.release_date_precision ?? "unknown",
      artwork: track.album.images,
    },
    previewUrl: track.preview_url ?? null,
    retrievedAt: new Date().toISOString(),
    raw,
  };
}
