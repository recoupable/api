import { getAppleSongsByIsrc } from "@/lib/apple/getAppleSongsByIsrc";
import { resolveAppleArtworkUrl } from "@/lib/apple/resolveAppleArtworkUrl";
import { updateSongArtworkUrl } from "@/lib/supabase/songs/updateSongArtworkUrl";

/**
 * Resolve artwork for songs that have none stored: one batched Apple Music
 * ISRC lookup, then a write-through to `songs.artwork_url` so later profile
 * builds never re-ask Apple.
 *
 * Apple is a third party on a public path, so every failure degrades to "no
 * artwork" — an Apple outage or a write failure can never take the page down.
 *
 * @param missingIsrcs - ISRCs with no stored artwork.
 * @returns Record of ISRC → artwork URL for the songs Apple carried.
 */
export async function resolveSongArtwork(missingIsrcs: string[]): Promise<Record<string, string>> {
  if (!missingIsrcs.length) return {};

  const { results, error } = await getAppleSongsByIsrc({
    isrcs: missingIsrcs,
    storefront: "us",
  });
  if (error || !results) {
    console.error("Apple artwork lookup failed for public profile:", error);
    return {};
  }

  const artwork: Record<string, string> = {};
  for (const result of results) {
    const url = result.songs?.[0]?.artwork_url;
    if (result.found && url) artwork[result.isrc] = resolveAppleArtworkUrl(url);
  }

  await Promise.all(
    Object.entries(artwork).map(async ([isrc, url]) => {
      try {
        await updateSongArtworkUrl(isrc, url);
      } catch (writeError) {
        console.error("Artwork write-through failed:", writeError);
      }
    }),
  );

  return artwork;
}
