import { SpotifyTrack } from "@/types/spotify.types";
import { getSpotifyArtistNames } from "./getSpotifyArtistNames";
import { getArtistsWithGenres } from "./getArtistsWithGenres";
import { formatTrackNotes } from "./formatTrackNotes";

/**
 * Generates descriptive notes for a Spotify track
 *
 * @param track - The raw Spotify track object from getIsrc
 * @returns Promise containing the generated notes
 */
export const generateTrackNotes = async (track: SpotifyTrack): Promise<string> => {
  if (!track.name) {
    return "";
  }

  try {
    const artistsWithGenres = await getArtistsWithGenres(track);
    return formatTrackNotes(track, artistsWithGenres);
  } catch (error) {
    console.error("Error generating track notes:", error);
    const artistNames = getSpotifyArtistNames(track.artists);
    return `${track.name} by ${artistNames} - a musical track from ${track.album.name || "an album"}.`;
  }
};
