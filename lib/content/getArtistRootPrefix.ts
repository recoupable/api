/**
 *
 * @param paths
 * @param artistSlug
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
