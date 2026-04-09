import type { Tables } from "@/types/database.types";
import { filterFilesByPath } from "@/lib/files/filterFilesByPath";
import { getFilesByArtistId } from "@/lib/supabase/files/getFilesByArtistId";

type FileRecord = Tables<"files">;

export interface ListedFileRecord extends FileRecord {
  owner_email: string | null;
}

/**
 * Lists files for an artist, optionally filtered by path.
 *
 * @param artistAccountId - Artist account whose files should be listed.
 * @param path - Optional relative directory path.
 * @param recursive - Whether to include descendant files recursively.
 * @returns Matching file rows.
 */
export async function listFilesByArtist(
  artistAccountId: string,
  path?: string,
  recursive: boolean = false,
): Promise<FileRecord[]> {
  const allFiles = await getFilesByArtistId(artistAccountId);

  if (recursive) {
    if (path) {
      const pathPrefix = path.endsWith("/") ? path : `${path}/`;
      return allFiles.filter(file => {
        const match = file.storage_key.match(/^files\/[^\/]+\/[^\/]+\/(.+)$/);
        if (!match) return false;
        if (!match[1].startsWith(pathPrefix)) return false;

        return match[1] !== pathPrefix;
      });
    }

    return allFiles;
  }

  return filterFilesByPath(allFiles, path);
}
