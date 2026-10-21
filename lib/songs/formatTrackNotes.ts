import type { SpotifyTrack } from "@/types/spotify.types";

/** Formats already-fetched track metadata without provider requests or generated claims. */
export function formatTrackNotes(track: SpotifyTrack, artistNames: string): string {
  if (!track.name) return "";

  const albumName = track.album?.name || "Unknown Album";
  const summary = `${track.name} by ${artistNames} - a musical track from ${albumName}.`;
  if (
    !track.album?.release_date ||
    !Number.isFinite(track.duration_ms) ||
    !Number.isFinite(track.popularity) ||
    typeof track.explicit !== "boolean"
  ) {
    return summary;
  }

  const durationMinutes = Math.floor(track.duration_ms / 60000);
  const durationSeconds = Math.floor((track.duration_ms % 60000) / 1000);
  const durationFormatted = `${durationMinutes}:${durationSeconds.toString().padStart(2, "0")}`;
  return `${summary} The track was released on ${track.album.release_date}, has a popularity score of ${track.popularity}/100 and a duration of ${durationFormatted}. It has an explicit flag of ${track.explicit ? "true" : "false"}.`;
}
