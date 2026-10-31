import { CatalogSong } from "./getCatalogSongs";

function quoteField(value: string | null): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

/**
 * Formats headerless catalog rows for the scorer, escaping CSV field values.
 */
export function formatCatalogSongsAsCSV(songs: CatalogSong[]): string {
  const csvLines = songs.map(song => {
    const artistNames = song.artists.map(artist => artist.name).join(", ");
    const isrc = /[",\r\n]/.test(song.isrc) ? quoteField(song.isrc) : song.isrc;
    return [isrc, quoteField(song.name), quoteField(song.album), quoteField(artistNames)].join(",");
  });

  return csvLines.join("\n");
}
