import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { getSocialAccountIds } from "@/lib/artist/getSocialAccountIds";

function spotifyArtistId(profileUrl: string): string | null {
  try {
    const url = new URL(profileUrl.includes("://") ? profileUrl : `https://${profileUrl}`);
    if (url.hostname !== "open.spotify.com") return null;
    return url.pathname.match(/^\/(?:intl-[a-z]{2}\/)?artist\/([A-Za-z0-9]{22})\/?$/)?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve credit-bearing accounts sharing an exact public Spotify artist ID.
 * Older imports can keep credits on a separate account from the roster artist.
 * This read-only identity lookup never matches names, merges accounts or grants
 * access to an alias's private account data. Failure retains the requested artist.
 */
export async function resolveProfileArtistIds(
  artistId: string,
  profileUrls: string[],
): Promise<string[]> {
  const accountIds = new Set([artistId]);
  const spotifyIds = [
    ...new Set(profileUrls.map(spotifyArtistId).filter((id): id is string => !!id)),
  ];
  for (const id of spotifyIds) {
    try {
      const socials = (await selectSocials({ profileUrlContains: id })) ?? [];
      for (const social of socials) {
        // The database substring filter only finds candidates; exact URL parsing
        // prevents ID prefixes, query parameters and lookalike hosts from joining.
        if (spotifyArtistId(social.profile_url ?? "") !== id) continue;
        const linkedIds = await getSocialAccountIds(social.id);
        for (const accountId of linkedIds) accountIds.add(accountId);
      }
    } catch (error) {
      console.error("Error resolving public artist song identity:", error);
    }
  }
  return [...accountIds];
}
