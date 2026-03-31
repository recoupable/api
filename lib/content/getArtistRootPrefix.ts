/**
 * Determines the root path prefix for an artist directory within the repo file tree.
 * Prefers the canonical `artists/<slug>/` prefix, falling back to `<slug>/` if needed.
 *
 * @param paths - All blob paths in the repository file tree.
 * @param artistSlug - The artist's directory slug.
 * @returns The root prefix string (e.g. `"artists/my-artist/"`) to use when constructing file paths.
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
