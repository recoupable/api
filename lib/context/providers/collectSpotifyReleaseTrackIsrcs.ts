import { z } from "zod";

const spotifyId = z.string().regex(/^[A-Za-z0-9]{22}$/);
const isrc = z.string().regex(/^[A-Za-z]{2}[A-Za-z0-9]{3}[0-9]{7}$/);
const inputSchema = z
  .array(z.strictObject({ slotIndex: z.number().int().nonnegative(), spotifyTrackId: spotifyId }))
  .min(1)
  .max(100);
const trackSchema = z
  .object({
    id: spotifyId,
    external_ids: z.object({ isrc: z.string().optional() }).optional(),
  })
  .passthrough();

/** Source reader only. The caller must first obtain track slots from an authorized release result. */
export async function collectSpotifyReleaseTrackIsrcs(
  slots: z.input<typeof inputSchema>,
  accessToken: string,
  fetcher: typeof fetch = fetch,
) {
  const input = inputSchema.parse(slots);
  if (new Set(input.map(slot => slot.slotIndex)).size !== input.length)
    throw new Error("Duplicate release slot position");
  const ids = [...new Set(input.map(slot => slot.spotifyTrackId))];
  const observations = new Map<
    string,
    {
      state: "observed" | "missing_isrc" | "failed";
      isrc: string | null;
      sourceUrl: string;
      retrievedAt: string;
      elapsedMs: number;
      httpStatus: number | null;
      raw: unknown;
      gap: string | null;
    }
  >();
  let cursor = 0;
  const worker = async () => {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      const sourceUrl = `https://api.spotify.com/v1/tracks/${id}`;
      const retrievedAt = new Date().toISOString();
      const start = Date.now();
      let httpStatus: number | null = null;
      try {
        const response = await fetcher(sourceUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
          redirect: "error",
          signal: AbortSignal.timeout(20000),
        });
        httpStatus = response.status;
        if (!response.ok) throw new Error(`Spotify HTTP ${response.status}`);
        const raw: unknown = await response.json();
        const track = trackSchema.parse(raw);
        if (track.id !== id) throw new Error("Spotify track identity mismatch");
        const candidate = track.external_ids?.isrc;
        const verified =
          candidate && isrc.safeParse(candidate).success ? candidate.toUpperCase() : null;
        observations.set(id, {
          state: verified ? "observed" : "missing_isrc",
          isrc: verified,
          sourceUrl,
          retrievedAt,
          elapsedMs: Date.now() - start,
          httpStatus,
          raw,
          gap: verified ? null : "Spotify did not supply a valid ISRC for this track",
        });
      } catch (error) {
        observations.set(id, {
          state: "failed",
          isrc: null,
          sourceUrl,
          retrievedAt,
          elapsedMs: Date.now() - start,
          httpStatus,
          raw: null,
          gap:
            error instanceof Error && /^Spotify HTTP [0-9]{3}$/.test(error.message)
              ? error.message
              : "Spotify track response could not be verified",
        });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, ids.length) }, () => worker()));
  return {
    observations: ids.map(id => ({ spotifyTrackId: id, ...observations.get(id)! })),
    slots: input.map(slot => ({
      ...slot,
      state: observations.get(slot.spotifyTrackId)!.state,
      isrc: observations.get(slot.spotifyTrackId)!.isrc,
    })),
    requestedTrackCount: ids.length,
    observedIsrcCount: [...observations.values()].filter(item => item.state === "observed").length,
    providerCostUsd: null,
    limitations: [
      "Source observations are not persisted or linked to recording subjects by this reader.",
      "An ISRC observation does not establish ownership, rights, roster membership or composition identity.",
      "No failed lookup is retried automatically.",
    ],
  };
}
