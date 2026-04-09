import type { Tables } from "@/types/database.types";

type FileRecord = Tables<"files">;

/**
 * Filters file rows to immediate children of the provided relative path.
 *
 * @param files - File rows to filter.
 * @param path - Optional relative directory path.
 * @returns The filtered file rows.
 */
export function filterFilesByPath(files: FileRecord[], path?: string): FileRecord[] {
  return files.filter(file => {
    const match = file.storage_key.match(/^files\/[^\/]+\/[^\/]+\/(.+)$/);
    if (!match) return false;

    const relativePath = match[1];

    if (path) {
      const pathPrefix = path.endsWith("/") ? path : `${path}/`;
      if (!relativePath.startsWith(pathPrefix)) return false;

      const relativeToFilter = relativePath.slice(pathPrefix.length);
      const trimmed = relativeToFilter.endsWith("/")
        ? relativeToFilter.slice(0, -1)
        : relativeToFilter;

      return trimmed.length > 0 && !trimmed.includes("/");
    }

    const trimmed = relativePath.endsWith("/") ? relativePath.slice(0, -1) : relativePath;

    return trimmed.length > 0 && !trimmed.includes("/");
  });
}
