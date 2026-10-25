import { selectContentArtists } from "@/lib/supabase/accounts/selectContentArtists";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { resolveArtistSlug } from "@/lib/content/resolveArtistSlug";

type ContentArtistSelection =
  | { artistAccountId: string; artistSlug: string; error?: never }
  | { error: string; artistAccountId?: never; artistSlug?: never };

/** Resolve one explicitly mentioned, unambiguous artist in the authenticated account's roster. */
export async function resolveContentArtist(
  accountId: string,
  artistNames: string[] | undefined,
  prompt: string,
): Promise<ContentArtistSelection> {
  const name = artistNames?.[0]?.trim();
  if (artistNames?.length !== 1 || !name) {
    return {
      error:
        'Please specify exactly one artist by full name (for example, "make a video for North Star").',
    };
  }

  // The model may extract a name, but it cannot invent the explicit selection.
  const literal = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(`(^|[^\\p{L}\\p{N}_])${literal}(?=$|[^\\p{L}\\p{N}_])`, "iu").test(prompt)) {
    return { error: "Please include the artist's full name explicitly in your request." };
  }

  const artists = [
    ...new Map((await selectContentArtists(accountId)).map(artist => [artist.id, artist])).values(),
  ];
  const matches = artists.filter(
    artist => artist.name?.trim().toLowerCase() === name.toLowerCase(),
  );
  if (matches.length !== 1) {
    return {
      error:
        "No unique accessible artist matches that full name. Check the name and your artist roster.",
    };
  }

  const artist = matches[0];
  // The worker addresses directories by slug, not UUID. Reject colliding roster
  // names using the same transformation as resolveArtistSlug (e.g. A B / A-B).
  const expectedSlug = artist.name!.toLowerCase().replace(/\s+/g, "-");
  // Downstream workers interpolate this value into GitHub paths/URLs. A name
  // must remain one literal directory segment, never a path or URL modifier.
  if (expectedSlug === "." || expectedSlug === ".." || /[/\\%?#]/.test(expectedSlug)) {
    return {
      error:
        "That artist's name cannot safely identify a content directory. Update the artist name before generating.",
    };
  }
  if (
    artists.some(
      candidate =>
        candidate.id !== artist.id &&
        candidate.name?.toLowerCase().replace(/\s+/g, "-") === expectedSlug,
    )
  ) {
    return {
      error:
        "That artist's content directory is ambiguous. Resolve the duplicate artist names before generating.",
    };
  }
  if (!(await checkAccountArtistAccess(accountId, artist.id))) {
    return {
      error:
        "No unique accessible artist matches that full name. Check the name and your artist roster.",
    };
  }
  const artistSlug = await resolveArtistSlug(artist.id);
  if (!artistSlug || artistSlug !== expectedSlug) {
    return { error: "The artist changed during selection. Please check the name and try again." };
  }
  return { artistAccountId: artist.id, artistSlug };
}
