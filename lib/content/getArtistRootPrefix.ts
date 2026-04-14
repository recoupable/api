/**
 * Get Artist Root Prefix.
 *
 * @param paths - Value for paths.
 * @param artistSlug - Value for artistSlug.
 * @returns - Computed result.
 */
export function getArtistRootPrefix(paths: string[], artistSlug: string): string {
  const preferredPrefix = `artists/${artistSlug}/`;
  if (paths.some(path => path.startsWith(preferredPrefix))) {
    return preferredPrefix;
  }

  const directPrefix = `${artistSlug}/`;
  if (paths.some(path => path.startsWith(directPrefix))) {
    return directPrefix;
  }

  return preferredPrefix;
}
