import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getTracks from "@/lib/spotify/getTracks";
import { upsertSongs } from "@/lib/supabase/songs/upsertSongs";
import { upsertSongIdentifiers } from "@/lib/supabase/song_identifiers/upsertSongIdentifiers";
import { SpotifyAlbumPlayCounts } from "@/lib/apify/spotify/fetchSpotifyAlbumPlayCounts";
import { SpotifyRateLimitError } from "@/lib/spotify/SpotifyRateLimitError";
import { getSpotifyArtists } from "@/lib/songs/getSpotifyArtists";
import { linkSongsToArtists } from "@/lib/songs/linkSongsToArtists";
import { queueRedisSongs } from "@/lib/songs/queueRedisSongs";
import { SongWithSpotify } from "@/lib/songs/getSongsByIsrc";

/**
 * Self-mapping bootstrap (chat#1794): resolve ISRCs for actor tracks that have
 * no identifier mapping yet — batch Spotify `/v1/tracks` lookup — and upsert
 * the `songs` rows plus track_id/album_id mappings. Failures degrade to an
 * empty map (logged): capture proceeds for already-mapped tracks and the next
 * snapshot retries the rest.
 *
 * @param albums - Parsed actor album items (with album `id`)
 * @param mappedTrackIds - Track ids that already have mappings
 * @returns Newly created trackId → ISRC mappings
 */
export async function mapUnmappedAlbumTracks(
  albums: SpotifyAlbumPlayCounts[],
  mappedTrackIds: Set<string>,
): Promise<Map<string, string>> {
  const unmapped = albums.flatMap(album =>
    (album.tracks ?? [])
      .filter(track => !mappedTrackIds.has(track.id))
      .map(track => ({ trackId: track.id, albumId: album.id, albumName: album.name })),
  );
  if (unmapped.length === 0) return new Map();

  try {
    const { access_token, error: tokenError } = await generateAccessToken();
    if (!access_token) throw tokenError ?? new Error("No Spotify access token");

    const { tracks, error } = await getTracks({
      ids: unmapped.map(u => u.trackId),
      accessToken: access_token,
    });
    if (!tracks) throw error ?? new Error("Spotify tracks lookup failed");

    const contextByTrackId = new Map(unmapped.map(u => [u.trackId, u]));
    const resolved = tracks.flatMap(track => {
      const isrc = track.external_ids?.isrc;
      const context = contextByTrackId.get(track.id);
      if (!isrc || !context) return [];
      return [
        {
          trackId: track.id,
          isrc,
          name: track.name,
          albumId: context.albumId,
          albumName: context.albumName,
          spotifyArtists: getSpotifyArtists(track.artists ?? []),
        },
      ];
    });
    if (resolved.length === 0) return new Map();

    // Dedupe by ISRC: reissues put the same recording on several albums in one
    // batch, and upsertSongs' DO UPDATE cannot affect the same row twice. Carry
    // the Spotify artists through for enrichment.
    const songsByIsrc = new Map<string, SongWithSpotify>(
      resolved.map(r => [
        r.isrc,
        {
          isrc: r.isrc,
          name: r.name ?? null,
          album: r.albumName ?? null,
          spotifyArtists: r.spotifyArtists,
        },
      ]),
    );
    const songs = [...songsByIsrc.values()];

    await upsertSongs(
      songs.map(song => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { spotifyArtists, ...record } = song;
        return record;
      }),
    );
    await upsertSongIdentifiers(
      resolved.flatMap(r => [
        { song: r.isrc, platform: "spotify", identifier_type: "track_id", value: r.trackId },
        ...(r.albumId
          ? [{ song: r.isrc, platform: "spotify", identifier_type: "album_id", value: r.albumId }]
          : []),
      ]),
    );

    // Root cause (chat#1801): give captured songs the same enrichment as the
    // manual/CSV flow — link artists (auto-creating the artist account) and
    // queue note generation — so valuation tracks aren't "missing info" and
    // render in the catalog view rather than being filtered out.
    await linkSongsToArtists(songs);
    await queueRedisSongs(songs);

    return new Map(resolved.map(r => [r.trackId, r.isrc]));
  } catch (error) {
    if (error instanceof SpotifyRateLimitError) throw error;
    console.error("[playcounts] identifier bootstrap failed:", error);
    return new Map();
  }
}
