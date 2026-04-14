import { CatalogSong } from "./getCatalogSongs";

/**
 * Format Catalog Songs As CSV.
 *
 * @param songs - Value for songs.
 * @returns - Computed result.
 */
export function formatCatalogSongsAsCSV(songs: CatalogSong[]): string {
  const csvLines = songs.map(song => {
    const artistNames = song.artists.map(artist => artist.name).join(", ");
    return `${song.isrc},"${song.name}","${song.album}","${artistNames}"`;
  });

  return csvLines.join("\n");
}
